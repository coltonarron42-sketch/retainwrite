/**
 * PC-31 (Colton t207u): the pasteable-prose gate. After generation (typed replies
 * and voice replies before they're spoken), a long block of original prose that
 * reads like a submittable paragraph or section is stripped and replaced with a
 * reframe question. Research summaries in bullets, quotes, questions and short
 * sentence starters the student must finish pass. Tunables: prose-gate.config.ts.
 * // SOP: coaching only, never generate submission text
 */
import {
  ARGUMENT_MARKERS,
  CONVERSATIONAL,
  FORMAL_MARKERS,
  PROSE_GATE,
  REFRAME_FOR,
  REFRAME_QUESTIONS,
} from "@/lib/coach/prose-gate.config";

export type GateOpts = {
  /** The student just asked her to write something ("write my intro"): tighter thresholds. */
  afterWriteRequest?: boolean;
  /** The student's message or section title, to pick a section-specific reframe. */
  context?: string;
  /** Names from their material (their leader, their story's people): a third-person paragraph about them scores higher. */
  names?: string[];
  /** Rotates the generic reframe for variety. */
  seed?: number;
  /** What the student said this turn (their story): a run that mostly reuses their words is a read-back, not prose. */
  echo?: string;
};

const contentWords = (s: string) => (s.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? []).map((w) => w.replace(/['’]s$/, ""));

/** Share of the run's content words that the student already said. */
export function echoShare(text: string, echo: string | undefined): number {
  if (!echo) return 0;
  const theirs = new Set(contentWords(echo));
  const ws = contentWords(text);
  if (!ws.length || !theirs.size) return 0;
  return ws.filter((w) => theirs.has(w)).length / ws.length;
}

type Piece = { item: number; text: string; kind: "decl" | "question" | "bullet" | "starter" | "quote" | "sourced" };

/**
 * PC-32 polish: a structured answer's labeled research paragraph ("From general background (check before
 * citing): …", "From your Goleman article: …") is sourced facts (capped at 2-3 short items), not essay prose.
 */
const SOURCED_LEAD = /^(?:From general background \(check before citing\)|From your [^:]{1,60}):\s/;

export type ProseRun = { sentences: number; words: number; score: number; reasons: string[]; text: string; pieces: Piece[] };

const BULLET = /^\s*(?:[•\-*–]|\d{1,2}[.)])\s+/;
const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;

function sentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out = t.match(/[^.!?…]+(?:[.!?…]+["”’)\]]*|$)/g) ?? [t];
  // Re-join splits inside common abbreviations and initials ("Dr.", "U.S.", "J. Smith").
  const merged: string[] = [];
  for (const s0 of out) {
    const s = s0.trim();
    if (!s) continue;
    const prev = merged[merged.length - 1];
    if (prev && /(?:\b(?:Dr|Mr|Mrs|Ms|Prof|St|vs|etc|e\.g|i\.e|Inc|Co|Jr|Sr)\.|\b[A-Z]\.)$/.test(prev)) merged[merged.length - 1] = `${prev} ${s}`;
    else merged.push(s);
  }
  return merged;
}

function classify(s: string): Piece["kind"] {
  const t = s.trim();
  if (/\?["”’)]*$/.test(t)) return "question";
  if (/^["“‘']/.test(t) || /^[^"“]{0,40}["“][^"”]{20,}["”][^"“]{0,40}$/.test(t)) return "quote";
  if ((/(?:…|\.\.\.|_{3,}|:)\s*["”’)]*$/.test(t) || /_{3,}/.test(t)) && wc(t) <= PROSE_GATE.starterMaxWords) return "starter";
  return "decl";
}

/** Split reply items (paragraphs or bullet lines) into sentence pieces. */
function pieces(items: string[]): Piece[] {
  const out: Piece[] = [];
  items.forEach((raw, item) => {
    for (const line of raw.split(/\n+/)) {
      const l = line.trim();
      if (!l) continue;
      if (SOURCED_LEAD.test(l)) {
        for (const x of sentences(l)) out.push({ item, text: x, kind: /\?["”’)]*$/.test(x) ? "question" : "sourced" });
        continue;
      }
      if (BULLET.test(l) && wc(l) <= PROSE_GATE.bulletMaxWords) {
        out.push({ item, text: l, kind: "bullet" });
        continue;
      }
      for (const s of sentences(l.replace(BULLET, ""))) out.push({ item, text: s, kind: classify(s) });
    }
  });
  return out;
}

function score(text: string, names: string[] = []): { score: number; reasons: string[] } {
  const w = PROSE_GATE.weights;
  const reasons: string[] = [];
  let s = 0;
  const formal = Math.min(w.formalCap, FORMAL_MARKERS.filter((re) => re.test(text)).length) * w.formal;
  if (formal) {
    s += formal;
    reasons.push(`formal:${formal}`);
  }
  if (!CONVERSATIONAL.test(text)) {
    s += w.thirdPerson;
    reasons.push("third-person");
  }
  const t2 = text.replace(/[’]/g, "'");
  const contraction = /\b\w+'(?:re|ve|ll|d|t|m)\b/i.test(t2) || /\b(?:it|that|there|here|what|who|she|he|let|where|how)'s\b/i.test(t2);
  if (!contraction) {
    s += w.noContractions;
    reasons.push("no-contractions");
  }
  if (ARGUMENT_MARKERS.test(text)) {
    s += w.argument;
    reasons.push("argues");
  }
  if (names.some((n) => n && n.length > 2 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) && !CONVERSATIONAL.test(text)) {
    s += w.aboutTheirMaterial;
    reasons.push("about-their-material");
  }
  return { score: s, reasons };
}

/** Every run of consecutive declarative sentences that crosses the thresholds. */
export function findPasteableRuns(items: string[] | string, o: GateOpts = {}): ProseRun[] {
  const list = typeof items === "string" ? [items] : items;
  const lim = o.afterWriteRequest ? PROSE_GATE.afterWriteRequest : PROSE_GATE;
  const ps = pieces(list);
  const runs: ProseRun[] = [];
  let cur: Piece[] = [];
  const flush = () => {
    if (cur.length >= lim.minSentences) {
      const text = cur.map((p) => p.text).join(" ");
      const words = wc(text);
      const sc = words >= Math.min(lim.minWords, PROSE_GATE.strongMinWords) ? score(text, o.names) : null;
      if (sc && (words >= lim.minWords || sc.score >= PROSE_GATE.strongScore)) {
        if (sc.score >= lim.minEssayScore && echoShare(text, o.echo) < PROSE_GATE.echoShare) runs.push({ sentences: cur.length, words, score: sc.score, reasons: sc.reasons, text, pieces: cur });
      }
    }
    cur = [];
  };
  for (const p of ps) {
    if (p.kind === "decl") cur.push(p);
    else flush();
  }
  flush();
  return runs;
}

export function reframeQuestion(o: GateOpts = {}): string {
  const hit = REFRAME_FOR.find((r) => r.re.test(o.context ?? ""));
  if (hit) return hit.q;
  return REFRAME_QUESTIONS[Math.abs(o.seed ?? 0) % REFRAME_QUESTIONS.length]!;
}

export type GateResult = { blocked: boolean; paras: string[]; reason?: string; removedWords?: number };

/**
 * Typed path: strip each pasteable run and end the reply on one reframe question
 * (any other question in the reply goes, so it stays one ask).
 */
export function gateParas(paras: string[], o: GateOpts = {}): GateResult {
  const runs = findPasteableRuns(paras, o);
  if (!runs.length) return { blocked: false, paras };
  const drop = new Set(runs.flatMap((r) => r.pieces.map((p) => `${p.item}|${p.text}`)));
  const kept: string[] = [];
  const ps = pieces(paras);
  const byItem = new Map<number, string[]>();
  for (const p of ps) {
    if (drop.has(`${p.item}|${p.text}`) || p.kind === "question") continue;
    byItem.set(p.item, [...(byItem.get(p.item) ?? []), p.text]);
  }
  for (const [, texts] of [...byItem.entries()].sort((a, b) => a[0] - b[0])) {
    const t = texts.join(texts.some((x) => BULLET.test(x)) ? "\n" : " ").trim();
    if (t) kept.push(t);
  }
  // A lone acknowledgement left over is fine; a leftover chunk of the essay is not (it was in a run).
  return {
    blocked: true,
    paras: [...kept.slice(0, 4), reframeQuestion(o)],
    reason: runs.map((r) => `run:${r.sentences}s/${r.words}w/score${r.score}(${r.reasons.join(",")})`).join(" "),
    removedWords: runs.reduce((n, r) => n + r.words, 0),
  };
}

/** Voice path: is this (partial or full) transcript turning into pasteable prose? */
export function proseVerdict(transcript: string, o: GateOpts = {}): { block: false } | { block: true; reason: string } {
  const runs = findPasteableRuns(transcript, o);
  return runs.length ? { block: true, reason: `prose:${runs[0]!.sentences}s/${runs[0]!.words}w/score${runs[0]!.score}` } : { block: false };
}
