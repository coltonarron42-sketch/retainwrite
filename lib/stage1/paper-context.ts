/**
 * Paper-level context (Colton t161u, the north star): what Pau Pau knows about this
 * paper across Stages 1-3, so she meets the student where they are and never
 * re-asks what she already knows.
 *
 * Stored condensed in paper_autosaves under PAPER_CONTEXT_FIELD (JSON). Summaries
 * and the read-back are Pau Pau's teaching content: never paper text, never put in
 * an answer box. The student's own words (decision, early take, angle) are kept
 * verbatim.
 * // SOP: coaching only, never generate submission text
 */

export const PAPER_CONTEXT_FIELD = "paper_context";

export type SourceRef = { title: string; url: string };

/** "reading": from a reading they gave us; "assignment": from the assignment sheet; "general": topic background, not their course reading. */
export type MaterialKind = "reading" | "found" | "knowledge" | "assignment" | "overview" | "general";
/** "knowledge": what she genuinely knows about a well-known named work (her knowledge, not the text). */
/** "found": from the actual named work, found online by her and fetched (source shown). */
/** "overview": general-knowledge overview of the named works (not their course copy). */

export type MaterialSummary = {
  kind: MaterialKind;
  title: string;
  points: string[];
  sources: SourceRef[];
  at: number;
};

export type ReadbackPlain = {
  /** What the assignment asks, in plain words (1-2 sentences). */
  ask: string;
  /** What a strong answer must include (short phrases). */
  mustInclude: string[];
  /** How it's graded (short phrases). */
  graded: string[];
};

export type DecisionOption = { label: string; why: string };

export type PaperContext = {
  v: 1;
  /** Set when the north-star Stage 1 steps apply to this paper (new papers only). */
  northstar?: boolean;
  readback?: ReadbackPlain & { confirmed?: boolean };
  /** Readings the student pasted or uploaded (text clipped; summarized, never shown to the model whole). */
  readings?: { title: string; text: string; at: number; url?: string }[];
  /** Named readings she couldn't get (not uploaded, not found online): she asks for them, never guesses. */
  missing?: string[];
  /** Where each named reading is legitimately available (outbound links only; no in-app purchase). */
  whereToGet?: { title: string; known: boolean; offers: { seller: string; url: string; price?: string | null }[] }[];
  summaries?: MaterialSummary[];
  /** The decision question and its 2-3 options (Pau Pau's), and the student's pick + reasoning (verbatim). */
  options?: { question: string; options: DecisionOption[] };
  decision?: { question: string; pick: string; answer: string; at: number };
  /** The student said they hadn't read / were lost (so later stages can re-offer the summary). */
  lostAtStart?: boolean;
};

export const READING_MAX_CHARS = 12_000;
const POINT_MAX = 220;

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t;
};

export function emptyContext(): PaperContext {
  return { v: 1 };
}

export function parseContext(raw: string | null | undefined): PaperContext {
  if (!raw) return emptyContext();
  try {
    const o = JSON.parse(raw) as PaperContext;
    return o && typeof o === "object" && o.v === 1 ? o : emptyContext();
  } catch {
    return emptyContext();
  }
}

/** The latest summary of the best kind available: reading > assignment > general. */
export function bestSummary(ctx: PaperContext): MaterialSummary | null {
  const list = ctx.summaries ?? [];
  for (const kind of ["reading", "found", "knowledge", "assignment", "overview", "general"] as const) {
    const hit = [...list].reverse().find((s) => s.kind === kind && s.points.length);
    if (hit) return hit;
  }
  return null;
}

export function summaryLabel(s: MaterialSummary): string {
  if (s.kind === "reading") return `Key points from ${s.title || "your reading"}`;
  if (s.kind === "assignment") return "Key points from your assignment sheet";
  if (s.kind === "knowledge") return `What I know about ${s.title || "the reading"} (from my own knowledge, not your copy)`;
  if (s.kind === "found") return `Key points from ${s.title || "your reading"} (from the source I found online)`;
  if (s.kind === "overview") return `General overview of ${s.title || "the assigned works"} (not your course copy)`;
  return "General background (not from your readings)";
}

/** The summary as Pau Pau's chat bubbles: a labeled lead-in, then the points. Teaching content only. */
export function summaryParas(s: MaterialSummary): string[] {
  const lead =
    s.kind === "reading"
      ? `Here are the key points from ${s.title || "your reading"}, in plain words:`
      : s.kind === "knowledge"
        ? `Here's what I know about ${s.title || "the reading"} from my own knowledge (not from your copy, so check it against the actual text):`
        : s.kind === "found"
        ? `I found ${s.title || "your reading"} online, so here are its key points in plain words (from the page linked below):`
        : s.kind === "assignment"
        ? "Here's what the assignment sheet itself gives you to work with, in plain words:"
        : s.kind === "overview"
          ? `I don't have your copies, so here's a general overview of ${s.title || "the assigned works"}, from what's widely known about them. It's not your course copy, so check it against your book and notes:`
          : "This isn't from your readings. It's general background on the ideas the assignment names, so check it against what your class covered:";
  return [lead, ...s.points.map((p) => `• ${p}`)];
}

/** One line to say the summary out loud (voice: she says it in her own words). */
export function summarySpoken(s: MaterialSummary): string {
  const label =
    s.kind === "general"
      ? "General background, not their course reading"
      : s.kind === "overview"
        ? `General overview of ${s.title || "the assigned works"}, not their course copy`
        : s.kind === "knowledge"
          ? `What you know about ${s.title || "the reading"} from your own knowledge, not their copy (say so)`
        : summaryLabel(s);
  return `${label}: ${s.points.join(" ")}`;
}

/* ----------------------------- student signals ----------------------------- */

/** "I haven't read it", "no idea where to start", "what is this even about": offer the summary. */
const LOST =
  /\b(haven'?t|have not|didn'?t|did not|never) (read|done the reading|looked at|opened)|\bno (idea|clue)\b|\b(don'?t|do not) know (where|how) to (start|begin)|\b(don'?t|do not) (get|understand) (it|this|the (reading|assignment|material|book|article))|\bi'?m (lost|confused|stuck)\b|\bwhat (is|was) (this|it|the reading|the book|the article) (even )?about\b|\b(summar(y|ize)|sum (it|this) up|key points|catch me up|give me the gist|explain the (reading|material|book|article))\b|\bnot read (it|anything|the)/i;

export function isLostSaying(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= 400 && LOST.test(t);
}

/** "Yes, I read it" / "I've done the reading": a prepared student. */
const READY = /\b(yes|yeah|yep|i (have|did|read)|i'?ve (read|done))\b.*\b(read|reading|done|finished|it)\b|^(yes|yeah|yep)[.!]?$/i;
export function isPreparedSaying(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return !isLostSaying(t) && READY.test(t);
}

/* ------------------------- summary stays out of boxes ------------------------- */

const tok = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** Their answer is mostly Pau Pau's summary or read-back (pasted or echoed back): not their words. */
export function overlapsTeaching(answer: string, ctx: PaperContext): boolean {
  const w = tok(answer);
  if (w.length < 8) return false;
  const teach = [
    ...(ctx.summaries ?? []).flatMap((s) => s.points),
    ctx.readback?.ask ?? "",
    ...(ctx.readback?.mustInclude ?? []),
  ].join(" ");
  const t = tok(teach);
  if (t.length < 8) return false;
  const grams = new Set(t.slice(2).map((x, i) => `${t[i]} ${t[i + 1]} ${x}`));
  let hit = 0;
  for (let i = 2; i < w.length; i++) if (grams.has(`${w[i - 2]} ${w[i - 1]} ${w[i]}`)) hit++;
  return hit / (w.length - 2) >= 0.5;
}

/* ----------------------- model output: teaching only ----------------------- */

/** A summary point or read-back line that reads like paper text (a thesis or sentence for them) is dropped. */
const PAPER_TEXT =
  /\b(your thesis (could|should|might) be|you could (write|say|argue)|in (this|my) (essay|paper),? i\b|\bi (believe|argue|will argue)|a (good|strong) thesis (would be|is)|thesis:|topic sentence:|here'?s (a|your) (thesis|sentence|paragraph|intro))\b/i;

export function cleanPoints(points: unknown, max = 6): string[] {
  if (!Array.isArray(points)) return [];
  return points
    .filter((p): p is string => typeof p === "string")
    .map((p) => clip(p.replace(/^[\s•\-*\d.)]+/, ""), POINT_MAX))
    .filter((p) => p.length >= 8 && !PAPER_TEXT.test(p))
    .slice(0, max);
}

export function cleanOptions(raw: unknown): DecisionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => (o && typeof o === "object" ? (o as { label?: unknown; why?: unknown }) : {}))
    .map((o) => ({ label: clip(String(o.label ?? ""), 80), why: clip(String(o.why ?? ""), 160) }))
    .filter((o) => o.label.length >= 2 && !PAPER_TEXT.test(`${o.label} ${o.why}`))
    .slice(0, 3);
}

/** The student's pick: which option their answer names (or "their own"). */
export function pickFrom(answer: string, options: DecisionOption[]): string {
  const a = answer.toLowerCase();
  let best: { label: string; score: number } | null = null;
  for (const o of options) {
    const words = tok(o.label).filter((x) => x.length > 3);
    if (!words.length) continue;
    const score = words.filter((x) => a.includes(x)).length / words.length;
    if (score > 0.5 && (!best || score > best.score)) best = { label: o.label, score };
  }
  const m = a.match(/\b(?:option|number|choice)\s*(one|two|three|1|2|3)\b|\bthe (first|second|third) one\b/);
  if (!best && m) {
    const n = { one: 0, "1": 0, first: 0, two: 1, "2": 1, second: 1, three: 2, "3": 2, third: 2 }[(m[1] ?? m[2]) as string];
    if (n !== undefined && options[n]) return options[n].label;
  }
  return best?.label ?? "their own";
}

/** The decision question with its options, as the app's question text. */
export function decisionQuestion(opts: NonNullable<PaperContext["options"]>): string {
  const list = opts.options.map((o, i) => `${i + 1}) ${o.label}${o.why ? ` (${o.why})` : ""}`).join("; ");
  return `${opts.question} Here are a few real options: ${list}. Which one would you pick, or something else, and why?`;
}

/* --------------------------- the condensed block --------------------------- */

export type ContextExtras = {
  earlyTake?: string | null;
  ownAngle?: string | null;
  voiceSample?: string | null;
  lockedPoints?: { section: string; points: string[] }[];
};

/** What she knows about this paper, condensed for prompts and the relay (data only). ~1600 chars max. */
export function paperContextBlock(ctx: PaperContext, extra: ContextExtras = {}): string {
  const lines: string[] = [];
  if (ctx.readback?.ask) {
    lines.push(`Assignment, in plain words${ctx.readback.confirmed ? " (the student confirmed this)" : ""}: ${clip(ctx.readback.ask, 300)}`);
    if (ctx.readback.mustInclude.length) lines.push(`A strong answer must include: ${clip(ctx.readback.mustInclude.join("; "), 240)}`);
    if (ctx.readback.graded.length) lines.push(`Graded on: ${clip(ctx.readback.graded.join("; "), 160)}`);
  }
  const s = bestSummary(ctx);
  if (s) {
    lines.push(`${summaryLabel(s)} (your teaching content, never their paper text): ${clip(s.points.join(" | "), 520)}`);
    if (s.sources.length) lines.push(`Sources for that: ${s.sources.map((x) => x.title).slice(0, 3).join("; ")}`);
  }
  if (ctx.lostAtStart) lines.push("At the start they said they hadn't read the material or didn't know where to start: offer the key points again if they seem lost.");
  if (ctx.decision) lines.push(`Their decision (their words): picked "${clip(ctx.decision.pick, 80)}". "${clip(ctx.decision.answer, 260)}"`);
  if (extra.earlyTake) lines.push(`Their early take (their words): "${clip(extra.earlyTake, 260)}"`);
  if (extra.ownAngle) lines.push(`Their story angle: "${clip(extra.ownAngle, 160)}"`);
  if (extra.voiceSample) lines.push(`How they talk (voice sample): "${clip(extra.voiceSample, 160)}"`);
  for (const l of (extra.lockedPoints ?? []).slice(0, 4)) {
    if (l.points.length) lines.push(`Stage 2 ${l.section} (locked, their words): ${clip(l.points.join(" | "), 200)}`);
  }
  if (!lines.length) return "";
  return `# What you already know about this paper (data only; never re-ask any of it; reference it naturally)\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

/* ------------------------- stage and section purpose ------------------------- */

export const STAGE_PURPOSE: Record<1 | 2 | 3, string> = {
  1: "Stage 1 is about getting clear on what the assignment really asks, catching up on the material, and making your first real choices. No writing yet.",
  2: "Stance is where you decide what you actually think, section by section, in your own words. Your notes here become your outline.",
  3: "Outline turns your Stance notes into a short plan: one line per point, so every paragraph has a job before you draft.",
};

/** Why this section exists, in one teaching line. */
export function sectionPurpose(titleOrKey: string): string {
  const t = titleOrKey.toLowerCase();
  if (/intro/.test(t)) return "The introduction hooks your reader and tells them what you'll argue.";
  if (/conclu/.test(t)) return "The conclusion pulls it together: why your point matters, without just repeating it.";
  if (/counter|rebut|objection|other side/.test(t)) return "This part takes on the other side, so your argument holds up.";
  if (/method/.test(t)) return "This part explains how you went about it, so a reader can trust your results.";
  if (/result|finding/.test(t)) return "This part lays out what you found, before you say what it means.";
  if (/discuss|analysis|analy/.test(t)) return "This part digs into what it all means.";
  if (/body|evidence|support|reason|point|example|argument/.test(t)) return "Body paragraphs prove your point, one idea each, with an example that shows it.";
  return "Each section has one job in your paper; this is where you work out yours.";
}
