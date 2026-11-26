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
  /** The instructor's word range it was written to (PC-32: full length, Colton t221u). */
  targetMin?: number;
  targetMax?: number;
};

export type GhostInput = {
  assignment: string;
  requirements: string;
  readback: string;
  material: string;
  direction: string;
  startingKind: string;
  /** Word range the paper must meet (from the confirmed card). */
  targetMin: number;
  targetMax: number;
};

/** Words per double-spaced page, for page-length assignments. */
const WORDS_PER_PAGE = 275;

/** The instructor's word range from the confirmed length (words, pages, or an estimate); a sane default otherwise. */
export function ghostTargets(len: { wordsMin?: number; wordsMax?: number; pagesMin?: number; pagesMax?: number; wordsEstimateMin?: number; wordsEstimateMax?: number } | null | undefined): { min: number; max: number } {
  const l = len ?? {};
  const min0 = l.wordsMin ?? (l.pagesMin ? l.pagesMin * WORDS_PER_PAGE : undefined) ?? l.wordsEstimateMin;
  const max0 = l.wordsMax ?? (l.pagesMax ? l.pagesMax * WORDS_PER_PAGE : undefined) ?? l.wordsEstimateMax;
  let min = min0 ?? (max0 ? Math.round(max0 * 0.85) : 1000);
  let max = max0 ?? Math.round(min * 1.2);
  if (max < min) [min, max] = [max, min];
  min = Math.max(250, Math.min(min, 6000));
  max = Math.max(min, Math.min(max, 7000));
  return { min, max };
}

export const wordsIn = (t: string) => t.split(/\s+/).filter(Boolean).length;

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
    "If they ask about their own leader or style, still answer with real, specific facts (what the leader actually did), from paper_context or labelled as general background, never invented: just never in the reference paper's sentences or argument.",
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
 * Words that any coaching answer in this space uses (styles, teams, change, the paper's own
 * vocabulary). A ghost run made only of these (plus stopwords) is generic wording, not leakage.
 */
const GENERIC_WORDS = new Set(
  "leadership leader leaders lead leads leading led style styles servant transformational transactional situational democratic autocratic authentic charismatic laissez faire participative adaptive visionary coaching team teams employee employees people person staff worker workers followers follower organization organizations organizational company companies business change changes changing trust vision shared goal goals growth grow needs need first put puts motivate motivates motivation inspire inspires inspired decision decisions approach example examples paper essay argue argues argument thesis claim evidence research source sources study studies article reading readings chapter textbook author theory model book effective effectiveness success successful result results support supports show shows make makes help helps work works better best good great strong key important way ways often many much one two three second new real during through while because before after own others other future past time today world life day every something reward rewards punishment consequences clear adapt adapts adapting rely relies moment situation situations context contrast power control focus focuses differ differs different attention".split(" "),
);
/** Stock phrases a coach says about these topics (their 5-word runs never count). */
const GENERIC_PHRASES = [
  "servant leadership puts the needs of the team first",
  "the leader puts the needs of others first",
  "leading a team through a period of change",
  "transformational leadership inspires followers with a shared vision of the future",
  "transactional leadership uses rewards and consequences to get results",
  "situational leadership adapts the style to the readiness of the followers",
  "democratic leadership shares decisions with the team",
  "autocratic leadership makes decisions without input from the team",
  "use one real leader as your example",
  "say it in your own words",
  "what do you think about that",
  "this is a question to pursue not a sentence to paste",
  "check the author and the date yourself",
];
const GENERIC_GRAMS = new Set(GENERIC_PHRASES.flatMap((p) => [...gramSet(p, 5)]));

/**
 * A ghost n-gram worth protecting: not in the shared context, not stock wording, not mostly filler,
 * and not made only of everyday topic words plus the student's own terms (their leader, their style,
 * the words of their question).
 */
function distinctive(gram: string, allowed: Set<string>, topic: Set<string>): boolean {
  if (allowed.has(gram) || GENERIC_GRAMS.has(gram)) return false;
  const w = gram.split(" ");
  const stops = w.filter((x) => STOP.has(x)).length;
  if (stops * 2 > w.length) return false;
  return w.some((x) => !STOP.has(x) && !GENERIC_WORDS.has(x) && !topic.has(x));
}

/**
 * The ghost's ARGUMENT (its thesis and claim sentences: why, therefore, most effective...) is what a
 * student could lift. Its plain FACT sentences (what the leader did, when) state public facts any
 * good answer about that leader also states, so they're only protected against being reproduced.
 */
const ARGUMENT =
  /\b(because|therefore|thus|hence|so that|demonstrat\w*|prov(?:e|es|ed|ing)|suggest\w*|argu\w*|most effective|more effective|best|should|ultimately|in conclusion|conclud\w*|this means|which is why|clearly|highlight\w*|illustrat\w*|reveal\w*|exemplif\w*|essential|crucial|key to|stands? out|in short|overall|makes? (?:him|her|it|them|this)|is why|proves?|shows? (?:that|how|why)|evidence that)\b/i;
export function isArgumentSentence(sentence: string): boolean {
  return ARGUMENT.test(sentence);
}
const splitSentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

export type GhostLeakResult = { ok: boolean; rule?: "ngram8" | "ngram5" | "near" | "copy12" | "nearFact"; hits5: number; hits8: number; hitsFact?: number };

/**
 * Output gate (Colton t221u; tuned PC-32 QA 5:15 PM and 5:33 PM: block real leakage, not generic
 * wording and not plain facts about the student's own leader).
 * Only DISTINCTIVE ghost runs count: not in the allowed corpus (assignment, brief, readings and
 * sources text, the student's own messages and notes), not stock phrasing, not mostly stopwords,
 * not made only of everyday topic words plus the student's own terms (`topic`).
 * - Argument sentences (thesis, claims): blocks on any distinctive 8-word run, on 2+ distinct
 *   distinctive 5-word runs, or on a near-copy (≥ 8 novel content words, ≥ 70% from that sentence).
 * - Fact sentences: blocks only when one is reproduced: a distinctive 12-word run, or a sentence that
 *   takes ≥ 85% of ≥ 10 novel content words from it AND covers ≥ 70% of its content words.
 */
export function ghostLeakCheck(output: string, g: GhostScript | null, allowedCorpus = "", topicText = ""): GhostLeakResult {
  if (!g || !output.trim()) return { ok: true, hits5: 0, hits8: 0, hitsFact: 0 };
  const ghostSent = [g.thesis, ...g.outline.flatMap((s) => s.points), ...splitSentences(g.paper)].filter(Boolean);
  const argText = [g.thesis, ...ghostSent.filter(isArgumentSentence)].join("\n");
  const factText = ghostSent.filter((x) => x !== g.thesis && !isArgumentSentence(x)).join("\n");
  const topic = new Set(toks(topicText).filter((w) => !STOP.has(w)));
  const allowed5 = gramSet(allowedCorpus, 5);
  const allowed8 = gramSet(allowedCorpus, 8);
  const allowed12 = gramSet(allowedCorpus, 12);
  const out8 = gramSet(output, 8);
  const out12 = gramSet(output, 12);
  let hits8 = 0;
  for (const gram of gramSet(argText, 8)) if (out8.has(gram) && !allowed8.has(gram) && distinctive(gram, allowed5, topic)) hits8++;
  // Distinct RUNS: overlapping 5-grams of one copied stretch count once (a 6-word overlap is one run).
  const ghost5 = gramSet(argText, 5);
  const ot = toks(output);
  let hits5 = 0;
  let inRun = false;
  for (let i = 0; i + 5 <= ot.length; i++) {
    const gram = ot.slice(i, i + 5).join(" ");
    const hit = ghost5.has(gram) && distinctive(gram, allowed5, topic);
    if (hit && !inRun) hits5++;
    inRun = hit;
  }
  let hitsFact = 0;
  for (const gram of gramSet(factText, 12)) if (out12.has(gram) && !allowed12.has(gram) && distinctive(gram, allowed5, topic)) hitsFact++;
  const res = (rule?: GhostLeakResult["rule"]): GhostLeakResult => ({ ok: !rule, ...(rule ? { rule } : {}), hits5, hits8, hitsFact });
  if (hits8 > 0) return res("ngram8");
  if (hits5 >= 2) return res("ngram5");
  if (hitsFact > 0) return res("copy12");
  const allowedWords = new Set(toks(allowedCorpus));
  const keep = (w: string) => !STOP.has(w) && !GENERIC_WORDS.has(w);
  const sets = (xs: string[]) => xs.map((x) => new Set(toks(x).filter(keep))).filter((x) => x.size >= 6);
  const argSets = sets(splitSentences(argText));
  const factSets = sets(splitSentences(factText));
  for (const sentence of splitSentences(output)) {
    const novel = [...new Set(toks(sentence).filter((w) => keep(w) && !allowedWords.has(w) && !topic.has(w)))];
    const content = new Set(toks(sentence).filter(keep));
    if (novel.length >= 8) {
      for (const gs of argSets) if (novel.filter((w) => gs.has(w)).length / novel.length >= 0.7) return res("near");
    }
    if (novel.length >= 10) {
      for (const gs of factSets) {
        const from = novel.filter((w) => gs.has(w)).length / novel.length;
        const covers = [...gs].filter((w) => content.has(w)).length / gs.size;
        if (from >= 0.85 && covers >= 0.7) return res("nearFact");
      }
    }
  }
  return res();
}

/** Log-safe view: sizes and counts only, never text. */
export function ghostLogDetail(g: GhostScript | null): Record<string, unknown> {
  if (!g) return { ghost: false };
  return { ghost: true, words: wordsIn(g.paper), targetMin: g.targetMin ?? null, targetMax: g.targetMax ?? null, sections: g.outline.length, sources: g.sources.length, searches: g.searches, kind: g.startingKind };
}

/** Deep check that no ghost text appears in something about to leave the server. */
export function containsGhost(payload: unknown, g: GhostScript | null): boolean {
  if (!g) return false;
  const s = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
  if (s.includes(PREFIX)) return true;
  const probes = [g.thesis, ...g.paper.split(/(?<=[.!?])\s+/).slice(0, 40)].map((t) => t.trim()).filter((t) => t.length >= 40);
  return probes.some((p) => s.includes(p));
}

const SYSTEM_BASE =
  "You are writing an INTERNAL reference paper for a writing coach. It is never shown to the student, never exported, and never submitted; the coach uses it only as hidden guidance to ask better questions.";

export type GhostPlan = {
  thesis: string;
  outline: { section: string; points: string[]; words: number }[];
  sources: { title: string; url: string }[];
  notes: string[];
};

/** Step 1 (the only step that searches, ≤3): research and plan the paper section by section. */
export function ghostPlanPrompt(input: GhostInput): { system: string; user: string } {
  return {
    system: [
      SYSTEM_BASE,
      "Step 1 of 2: research and plan. Use web search (at most 3 searches) to find real, verifiable facts and sources, then plan a paper that fully meets the instructor's requirements (prompt, required parts, citation style).",
      "If the student shared a direction, build the plan around it; otherwise pick the strongest defensible direction. Use only real sources you actually found; never invent quotes, page numbers or sources. If assigned readings aren't available to you, rely on well-known, verifiable information about them.",
      `Plan sections whose word budgets ("words") add up to about ${Math.round((input.targetMin + input.targetMax) / 2)} words (the paper must land between ${input.targetMin} and ${input.targetMax} words), with an introduction and a conclusion. "notes" = 6-14 short research facts with their source, for the writer. Return JSON only.`,
    ].join("\n"),
    user: [
      `Assignment (verbatim, clipped):\n${input.assignment}`,
      `Confirmed requirements:\n${input.requirements}`,
      input.readback ? `What the paper is truly asking (confirmed by the student):\n${input.readback}` : "",
      input.material ? `Course material we have (summaries):\n${input.material}` : "",
      `Student's starting point: ${input.startingKind}${input.direction ? `\nTheir direction, in their words: ${input.direction}` : " (no direction yet)"}`,
      'Return JSON: {"thesis": string, "outline": [{"section": string, "points": string[], "words": number}], "sources": [{"title": string, "url": string}], "notes": string[]}',
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

const jsonOf = (text: string) => {
  const t = text.trim();
  return JSON.parse(t.startsWith("{") ? t : t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
};

/** Parse and bound the plan; word budgets are rescaled so they sum to the middle of the range. */
export function parseGhostPlan(text: string, input: Pick<GhostInput, "targetMin" | "targetMax">): GhostPlan | null {
  try {
    const o = jsonOf(text) as Partial<GhostPlan>;
    const outline = (Array.isArray(o.outline) ? o.outline : [])
      .slice(0, 10)
      .map((x) => ({
        section: String(x?.section ?? "").slice(0, 120),
        points: (Array.isArray(x?.points) ? x.points : []).slice(0, 8).map((p) => String(p).slice(0, 400)),
        words: Number(x?.words) > 0 ? Number(x?.words) : 0,
      }))
      .filter((x) => x.section);
    if (outline.length < 3 || !String(o.thesis ?? "").trim()) return null;
    return {
      thesis: String(o.thesis).slice(0, 600),
      outline: withBudgets(outline, input.targetMin, input.targetMax),
      sources: (Array.isArray(o.sources) ? o.sources : [])
        .slice(0, 12)
        .map((x) => ({ title: String(x?.title ?? "").slice(0, 200), url: String(x?.url ?? "").slice(0, 500) }))
        .filter((x) => /^https?:\/\//.test(x.url)),
      notes: (Array.isArray(o.notes) ? o.notes : []).slice(0, 16).map((n) => String(n).slice(0, 400)),
    };
  } catch {
    return null;
  }
}

/** Section budgets that add up to the middle of the instructor's range (their relative sizes kept). */
export function withBudgets<T extends { words: number }>(outline: T[], min: number, max: number): T[] {
  const goal = Math.round((min + max) / 2);
  const raw = outline.map((x) => (x.words > 0 ? x.words : goal / outline.length));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return outline.map((x, i) => ({ ...x, words: Math.max(80, Math.round((raw[i]! / sum) * goal)) }));
}

/** Step 2 (no search): write one section to its word budget. */
export function ghostSectionPrompt(input: GhostInput, plan: GhostPlan, i: number, opts: { have?: string; target?: number } = {}): { system: string; user: string } {
  const sec = plan.outline[i]!;
  const target = opts.target ?? sec.words;
  return {
    system: [
      SYSTEM_BASE,
      `Step 2 of 2: write ONE section of the paper, between ${target} and ${sectionCeil(target)} words (never fewer than ${target}: count them). Polished academic prose in plain paragraphs, no heading, no bullet points. Use only the research notes and sources given; never invent quotes, numbers or sources. Cite in the assignment's citation style when you use a source. Return JSON only: {"text": string}.`,
    ].join("\n"),
    user: [
      `Assignment requirements:\n${input.requirements.slice(0, 1500)}`,
      `Thesis: ${plan.thesis}`,
      `Whole outline:\n${plan.outline.map((x, k) => `${k + 1}. ${x.section} (~${x.words} words): ${x.points.join("; ")}`).join("\n")}`,
      plan.notes.length ? `Research notes:\n${plan.notes.map((n) => `- ${n}`).join("\n")}` : "",
      plan.sources.length ? `Sources:\n${plan.sources.map((x) => `- ${x.title} (${x.url})`).join("\n")}` : "",
      input.direction ? `The student's direction (build on it): ${input.direction}` : "",
      opts.have
        ? `Here is the current draft of section ${i + 1} ("${sec.section}"), ${wordsIn(opts.have)} words. Rewrite it to between ${target} and ${sectionCeil(target)} words (never fewer than ${target}), keeping its points:\n"""${opts.have}"""`
        : `Write section ${i + 1}: "${sec.section}" covering: ${sec.points.join("; ")}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** Upper bound for one section's ask: models tend to come in short, so ask for target..+10%. */
export function sectionCeil(target: number): number {
  return Math.round(target * 1.1);
}

export function parseSection(text: string): string | null {
  try {
    const t = String((jsonOf(text) as { text?: unknown }).text ?? "").trim();
    return wordsIn(t) >= 30 ? t.slice(0, 20_000) : null;
  } catch {
    return null;
  }
}

/**
 * Sections that need one more pass to bring the total into the range. Short or long, every
 * section is rewritten in proportion so the total lands on the middle of the range (a single
 * section can't be stretched far without padding). Empty when the total already fits.
 */
export function sectionsToFix(budgets: number[], written: string[], min: number, max: number): { i: number; target: number }[] {
  const have = written.map(wordsIn);
  const total = have.reduce((a, b) => a + b, 0);
  if (total >= min && total <= max) return [];
  const goal = Math.round((min + max) / 2);
  // A section the model under-wrote gets back at least to its budget when short.
  const factor = goal / Math.max(1, total);
  return have.map((h, i) => ({ i, target: Math.max(60, total < min ? Math.max(Math.round(h * factor), Math.min(budgets[i] ?? 0, Math.round(h * factor * 1.2))) : Math.round(h * factor)) }));
}

/** The finished ghost (null unless it lands inside the word range). */
export function assembleGhost(plan: GhostPlan, written: string[], meta: { inputHash: string; startingKind: string; searches: number; targetMin: number; targetMax: number }): GhostScript | null {
  const paper = written.filter(Boolean).join("\n\n").trim();
  const words = wordsIn(paper);
  // Enforced: the full paper meets the instructor's word range (never a short or overlong one).
  if (words < meta.targetMin || words > meta.targetMax) return null;
  return {
    v: 1,
    inputHash: meta.inputHash,
    thesis: plan.thesis,
    outline: plan.outline.map((x) => ({ section: x.section, points: x.points })),
    paper: paper.slice(0, 60_000),
    sources: plan.sources,
    startingKind: meta.startingKind,
    at: Date.now(),
    searches: meta.searches,
    targetMin: meta.targetMin,
    targetMax: meta.targetMax,
  };
}
