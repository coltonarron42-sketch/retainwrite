/**
 * Ghost script (Colton t221u, Nov 25, 2026; PC-32): an internal, complete reference paper Pau
 * writes from her own research once Stage 1 has the assignment (and any direction). It guides
 * later stages as HIDDEN guidance only.
 *
 * Hard rules (enforced here and in lib/server/ghost/store.ts, tested in tests/unit/pc32-ghost.test.ts):
 * - Never sent to the client: not in any API response, page prop, RSC payload, Past chat, export or log.
 * - Stored only encrypted (AES-256-GCM, key derived server-side) in an existing paper_autosaves row,
 *   so even the student's own RLS read returns ciphertext. No migration.
 * - Never quoted or paraphrased to the student: every student-facing reply that had it as guidance
 *   passes ghostLeakCheck (5-gram + near-sentence overlap) or is dropped.
 * // SOP: coaching only, never generate submission text (the ghost is never shown or exported)
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/** The paper_autosaves field key. Reserved: the autosave route never reads or writes it for a client. */
export const GHOST_FIELD = "server:ghost_script";
/** Any field key under this prefix is server-only. */
export const SERVER_ONLY_PREFIX = "server:";
export const isServerOnlyField = (fieldKey: string) => fieldKey.startsWith(SERVER_ONLY_PREFIX);

export type GhostScript = {
  v: 1;
  /** Hash of what it was built from, so the same input never regenerates. */
  inputHash: string;
  thesis: string;
  outline: { section: string; points: string[] }[];
  paper: string;
  sources: { title: string; url: string }[];
  /** Where the student was when it was written (has ideas / read the material / no clue). */
  startingKind: string;
  at: number;
  searches: number;
};

export type GhostInput = {
  assignment: string;
  requirements: string;
  readback: string;
  material: string;
  direction: string;
  startingKind: string;
};

export function ghostInputHash(input: GhostInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
}

const PREFIX = "rwg1:";

function keyFrom(secret: string): Buffer {
  if (!secret || secret.length < 16) throw new Error("ghost_key");
  return Buffer.from(hkdfSync("sha256", secret, "retainwrite", "ghost-script-v1", 32));
}

/** Encrypted for storage; the result is opaque to anyone without the server secret. */
export function sealGhost(ghost: GhostScript, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(ghost), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

/** Null on anything unreadable (tampered row, rotated key): the caller just regenerates. */
export function openGhost(sealed: string | null | undefined, secret: string): GhostScript | null {
  if (!sealed?.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(sealed.slice(PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const g = JSON.parse(json) as GhostScript;
    return g?.v === 1 && typeof g.paper === "string" ? g : null;
  } catch {
    return null;
  }
}

/**
 * The hidden guidance a later-stage prompt may see: structure only (no thesis,
 * section jobs, which real sources exist). Never the paper's prose.
 */
export function ghostGuidance(g: GhostScript | null): string {
  if (!g) return "";
  const outline = g.outline
    .slice(0, 8)
    .map((s) => `- ${s.section.slice(0, 60)}: ${s.points.slice(0, 4).map((p) => p.slice(0, 140)).join(" | ")}`)
    .join("\n");
  const sources = g.sources.slice(0, 6).map((s) => s.title.slice(0, 100)).join("; ");
  return [
    "HIDDEN GUIDANCE (internal reference paper Pau wrote; the student must never see it).",
    "Use it only to know where a strong paper could go and which questions to ask next. Never quote, paraphrase, summarize or hint at its wording, thesis or sentences; never present its ideas as the answer. The student's own ideas always win.",
    `Section jobs:\n${outline}`,
    sources ? `Real sources it used (you may suggest looking these up): ${sources}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Every text that came from the ghost, for the overlap gate. */
export function ghostCorpus(g: GhostScript | null): string {
  if (!g) return "";
  return [g.thesis, ...g.outline.flatMap((s) => s.points), g.paper].join("\n");
}

const STOP = new Set(
  "a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those they them their there here you your we our i me my he she his her not no so do does did have has had can could would should will just than then into about over more most some any all each very also what which who how why when where".split(" "),
);
const toks = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
const gramSet = (t: string, n: number) => {
  const p = toks(t);
  const out = new Set<string>();
  for (let i = 0; i + n <= p.length; i++) out.add(p.slice(i, i + n).join(" "));
  return out;
};

/**
 * Output gate (Colton t221u): a student-facing reply may not share any 5-word run with the ghost
 * (unless that run is already in the student's own words / the shared context), nor be a
 * near-copy of one ghost sentence (≥ 8 new content words, ≥ 70% of them from that sentence).
 */
export function ghostLeakCheck(output: string, g: GhostScript | null, allowedCorpus = ""): { ok: true } | { ok: false; rule: "ngram" | "near" } {
  if (!g || !output.trim()) return { ok: true };
  const corpus = ghostCorpus(g);
  const allowed = gramSet(allowedCorpus, 5);
  const out = gramSet(output, 5);
  for (const gram of gramSet(corpus, 5)) if (out.has(gram) && !allowed.has(gram)) return { ok: false, rule: "ngram" };
  const allowedWords = new Set(toks(allowedCorpus));
  const ghostSentences = corpus.split(/(?<=[.!?])\s+|\n+/).map((x) => new Set(toks(x).filter((w) => !STOP.has(w)))).filter((x) => x.size >= 6);
  for (const sentence of output.split(/(?<=[.!?])\s+|\n+/)) {
    const novel = [...new Set(toks(sentence).filter((w) => !STOP.has(w) && !allowedWords.has(w)))];
    if (novel.length < 8) continue;
    for (const gs of ghostSentences) {
      if (novel.filter((w) => gs.has(w)).length / novel.length >= 0.7) return { ok: false, rule: "near" };
    }
  }
  return { ok: true };
}

/** Log-safe view: sizes and counts only, never text. */
export function ghostLogDetail(g: GhostScript | null): Record<string, unknown> {
  if (!g) return { ghost: false };
  return { ghost: true, words: g.paper.split(/\s+/).filter(Boolean).length, sections: g.outline.length, sources: g.sources.length, searches: g.searches, kind: g.startingKind };
}

/** Deep check that no ghost text appears in something about to leave the server. */
export function containsGhost(payload: unknown, g: GhostScript | null): boolean {
  if (!g) return false;
  const s = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
  if (s.includes(PREFIX)) return true;
  const probes = [g.thesis, ...g.paper.split(/(?<=[.!?])\s+/).slice(0, 40)].map((t) => t.trim()).filter((t) => t.length >= 40);
  return probes.some((p) => s.includes(p));
}

/** The ghost prompt (system + user) for the generator. */
export function ghostPrompt(input: GhostInput): { system: string; user: string } {
  return {
    system: [
      "You are writing an INTERNAL reference paper for a writing coach. It is never shown to the student, never exported, and never submitted; the coach uses it only as hidden guidance to ask better questions.",
      "Write a complete, well-organized paper that fully meets the instructor's requirements (prompt, length, structure, citation style). Research the topic first with web search (at most 3 searches), then write from your own research and ideas.",
      "If the student shared a direction, build the paper around it; otherwise pick the strongest defensible direction. Use only real sources you actually found; never invent quotes, page numbers or sources. If assigned readings aren't available to you, rely on well-known, verifiable information and say nothing about their specific pages.",
      "Return JSON only.",
    ].join("\n"),
    user: [
      `Assignment (verbatim, clipped):\n${input.assignment}`,
      `Confirmed requirements:\n${input.requirements}`,
      input.readback ? `What the paper is truly asking (confirmed by the student):\n${input.readback}` : "",
      input.material ? `Course material we have (summaries):\n${input.material}` : "",
      `Student's starting point: ${input.startingKind}${input.direction ? `\nTheir direction, in their words: ${input.direction}` : " (no direction yet)"}`,
      'Return JSON: {"thesis": string, "outline": [{"section": string, "points": string[]}], "paper": string (the full paper), "sources": [{"title": string, "url": string}]}',
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** Parse and bound the model's JSON. */
export function parseGhost(text: string, meta: { inputHash: string; startingKind: string; searches: number }): GhostScript | null {
  try {
    const t = text.trim();
    const json = t.startsWith("{") ? t : t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
    const o = JSON.parse(json) as Partial<GhostScript>;
    const paper = typeof o.paper === "string" ? o.paper.trim() : "";
    if (paper.split(/\s+/).length < 150) return null;
    return {
      v: 1,
      inputHash: meta.inputHash,
      thesis: String(o.thesis ?? "").slice(0, 600),
      outline: (Array.isArray(o.outline) ? o.outline : [])
        .slice(0, 12)
        .map((s) => ({ section: String(s?.section ?? "").slice(0, 120), points: (Array.isArray(s?.points) ? s.points : []).slice(0, 8).map((p) => String(p).slice(0, 400)) })),
      paper: paper.slice(0, 40_000),
      sources: (Array.isArray(o.sources) ? o.sources : [])
        .slice(0, 12)
        .map((s) => ({ title: String(s?.title ?? "").slice(0, 200), url: String(s?.url ?? "").slice(0, 500) }))
        .filter((s) => /^https?:\/\//.test(s.url)),
      startingKind: meta.startingKind,
      at: Date.now(),
      searches: meta.searches,
    };
  } catch {
    return null;
  }
}
