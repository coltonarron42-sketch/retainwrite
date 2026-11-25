// SOP: coaching only, never generate submission text.
// PC-28 skeleton shape. Ghost paper #1 sets the shape (how many body paragraphs, examples,
// theories, transitions) from the real assignment; ghost paper #2 adds short body titles
// once the student has made their choices. The client only ever gets labels, subheadings
// and short titles from here, never the private plan.
import { z } from "zod";

export type SkeletonGroup = "intro" | "body" | "conclusion";

export type ShapeBlock = { key: string; group: SkeletonGroup; label: string; sub: string };

export type PaperShape = {
  v: 1;
  blocks: ShapeBlock[];
  transitions: number;
  examples: number;
  theories: number;
  /** What Pau needs the student to decide (server-side only; never rendered). */
  decisions: string[];
  source: "model" | "rules";
};

/** Ghost #2: one short title per body paragraph and which of the student's body notes it uses. */
export type ShapeOutline = {
  v: 1;
  /** fixed: made from their choices (or a real shape); a rules-shape placeholder ("leadership example 2") is not. */
  titles: { key: string; title: string; ideaRefs: number[]; fixed?: boolean }[];
  source: "model" | "rules";
  /** QA 3:26 AM #3: the locked choices (leader, styles) the shown titles were made from. */
  factsKey?: string;
};

/** What the client gets. Never includes private notes. */
export type SkeletonView = {
  blocks: { key: string; group: SkeletonGroup; label: string; sub: string; title: string | null; ideaRefs: number[] }[];
  transitions: string[];
  source: "model" | "rules";
};

export const BODY_MIN = 2;
export const BODY_MAX = 12;

/** The paper's target length in words, from the card or the sheet text. */
export function wordsTarget(input: { wordsMin?: number; wordsMax?: number; pagesMin?: number; pagesMax?: number; text?: string }): number | null {
  const w = input.wordsMax ?? input.wordsMin;
  if (w && w > 0) return w;
  const p = input.pagesMax ?? input.pagesMin;
  if (p && p > 0) return Math.round(p * 275);
  const t = (input.text ?? "").replace(/,/g, "");
  const words = t.match(/(\d{3,5})\s*(?:[-–—to]+\s*(\d{3,5}))?\s*words?\b/i);
  if (words) return Number(words[2] ?? words[1]);
  const pages = t.match(/(\d{1,2})\s*(?:[-–—to]+\s*(\d{1,2}))?\s*(?:-\s*)?pages?\b/i);
  if (pages) return Math.round(Number(pages[2] ?? pages[1]) * 275);
  return null;
}

/** Body paragraphs for a length: ~250 words each after the intro and conclusion. */
export function bodyCountFor(words: number | null): number {
  if (!words) return 3;
  return Math.min(BODY_MAX, Math.max(BODY_MIN, Math.round((words - 300) / 250)));
}

const INTRO_SUB = "hook, context and your thesis";
const CONCLUSION_SUB = "bring it home and recap";

function clean(s: string, max: number): string {
  return s.replace(/\s+/g, " ").replace(/[.!?;:]+$/g, "").trim().slice(0, max).trim();
}

/** The shape from rules alone (no model): demo mode and the fallback. */
export function ruleShape(input: { text: string; words?: number | null }): PaperShape {
  const words = input.words ?? wordsTarget({ text: input.text });
  const n = bodyCountFor(words);
  const t = input.text.toLowerCase();
  const theory = /\btheor(y|ies)|style|model|framework|concept\b/.test(t);
  const example = /\bexample|leader|case|experience|story\b/.test(t);
  const what = /leader/.test(t) ? "leadership example" : example ? "example" : "main point";
  const blocks: ShapeBlock[] = [{ key: "intro", group: "intro", label: "Introduction", sub: INTRO_SUB }];
  for (let i = 1; i <= n; i++) {
    const sub = theory && i === n && n >= 3 ? "tie it to the theory" : `${what} ${i}`;
    blocks.push({ key: `body-${i}`, group: "body", label: `Paragraph ${i}`, sub });
  }
  blocks.push({ key: "conclusion", group: "conclusion", label: "Conclusion", sub: CONCLUSION_SUB });
  return {
    v: 1,
    blocks,
    transitions: Math.max(1, n - 1),
    examples: example ? Math.max(1, n - (theory ? 1 : 0)) : 0,
    theories: theory ? 1 : 0,
    decisions: [],
    source: "rules",
  };
}

const modelShapeSchema = z.object({
  body: z
    .array(z.object({ focus: z.string().min(2), kind: z.string().optional() }))
    .min(BODY_MIN),
  transitions: z.number().optional(),
  examples: z.number().optional(),
  theories: z.number().optional(),
  decisions: z.array(z.string()).optional(),
});

/** QA 1:11 AM #1: a model answer that is a little off (long focus, 7 decisions) is trimmed, not thrown away. */
function lenientShape(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const body = (Array.isArray(r.body) ? r.body : Array.isArray(r.paragraphs) ? r.paragraphs : [])
    .map((b) => (typeof b === "string" ? { focus: b } : b))
    .filter((b): b is { focus: unknown; kind?: unknown } => Boolean(b) && typeof b === "object" && typeof (b as { focus?: unknown }).focus === "string")
    .slice(0, BODY_MAX)
    .map((b) => ({ focus: String(b.focus).slice(0, 120), kind: typeof b.kind === "string" ? b.kind.slice(0, 40) : undefined }));
  const int = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : undefined);
  return {
    body,
    transitions: int(r.transitions, 20),
    examples: int(r.examples, 20),
    theories: int(r.theories, 10),
    decisions: Array.isArray(r.decisions) ? r.decisions.filter((d): d is string => typeof d === "string").slice(0, 6).map((d) => d.slice(0, 160)) : undefined,
  };
}

/** A model shape, checked and capped. Labels stay generic (no names: it's shape only). */
export function shapeFromModel(raw: unknown): PaperShape | null {
  const parsed = modelShapeSchema.safeParse(lenientShape(raw));
  if (!parsed.success) return null;
  const body = parsed.data.body;
  const blocks: ShapeBlock[] = [{ key: "intro", group: "intro", label: "Introduction", sub: INTRO_SUB }];
  body.forEach((b, i) => {
    const sub = clean(b.focus, 60).toLowerCase() || `main point ${i + 1}`;
    blocks.push({ key: `body-${i + 1}`, group: "body", label: `Paragraph ${i + 1}`, sub });
  });
  blocks.push({ key: "conclusion", group: "conclusion", label: "Conclusion", sub: CONCLUSION_SUB });
  return {
    v: 1,
    blocks,
    transitions: parsed.data.transitions ?? Math.max(1, body.length - 1),
    examples: parsed.data.examples ?? 0,
    theories: parsed.data.theories ?? 0,
    decisions: (parsed.data.decisions ?? []).map((d) => clean(d, 160)).filter(Boolean),
    source: "model",
  };
}

export const SHAPE_SYSTEM = `You plan the SHAPE of a student's paper so a writing coach knows the structure. You never write any part of the paper.
Return JSON only: {"body":[{"focus":"...","kind":"example|theory|analysis|counter|evidence"}],"transitions":n,"examples":n,"theories":n,"decisions":["..."]}.
- body: one entry per body paragraph, in order. Size it to the assignment's length (about 250 words per body paragraph; a 10-page paper has many more than a 2-page one) and to what it requires (named examples, theories, styles, readings, counterarguments).
- focus: 2 to 7 words naming the paragraph's job for THIS assignment, lowercase, e.g. "the leader's change story", "style in action: first example", "tie it to Northouse's styles", "Goleman's emotional intelligence link", "counterargument and reply". You may name the theories, styles and readings the assignment itself names. Never the student's own choices, no claims, no sentences.
- decisions: up to 5 short questions the student must decide before drafting (e.g. "Which leader will you use?"). Never answer them.`;

const modelOutlineSchema = z.object({
  titles: z
    .array(z.object({ title: z.string().min(2).max(120), ideas: z.array(z.number().int().min(0).max(40)).max(12).optional() }))
    .max(BODY_MAX),
});

/** Short label: at most 10 words, no sentence punctuation. */
export function titleSafe(title: string): string {
  const t = clean(title.replace(/["“”]/g, ""), 80);
  const words = t.split(/\s+/).filter(Boolean);
  return words.slice(0, 10).join(" ");
}

const DANGLING = /\b(?:of|the|a|an|to|and|or|with|for|in|on|at|by|from|as|that|which|who|his|her|their|its|my|your|our|is|was|be|very|big|so|but)$/i;

/** QA 1:11 AM #1: a clean short title (whole comma parts, never cut mid-phrase), or "" to reject. */
export function cleanTitle(title: string, maxWords = 8): string {
  const t = title.replace(/["“”‘’]/g, "").replace(/\s+/g, " ").replace(/[.!?;:]+$/g, "").trim();
  if (!t || /[.!?]\s/.test(t)) return "";
  const parts = t.split(/\s*,\s*/).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if ([...out, part].join(" ").split(" ").length > maxWords) break;
    out.push(part);
  }
  const joined = out.join(", ");
  if (!joined || DANGLING.test(joined) || joined.split(" ").length < 2 && out.length < 2) return "";
  return joined;
}

export type OutlineFacts = { leader: string | null; styles: string[] };

export function outlineFromModel(raw: unknown, shape: PaperShape, bodyNotes: number, facts?: OutlineFacts): ShapeOutline | null {
  const parsed = modelOutlineSchema.safeParse(raw);
  if (!parsed.success) return null;
  const body = shape.blocks.filter((b) => b.group === "body");
  const rules = facts ? ruleOutline(shape, facts) : null;
  const titles = body.map((b, i) => {
    const m = parsed.data.titles[i];
    const title = m ? cleanTitle(m.title) : "";
    return {
      key: b.key,
      title: title || rules?.titles.find((t) => t.key === b.key)?.title || "",
      ideaRefs: (m?.ideas ?? []).filter((n) => n < bodyNotes),
      fixed: true,
    };
  });
  return { v: 1, titles: titles.filter((t) => t.title), source: "model" };
}

/** QA 3:26 AM #3: what a title may change for: the student's locked leader and styles only. */
export function factsKeyOf(facts: OutlineFacts): string {
  return inputHash(JSON.stringify({ l: (facts.leader ?? "").trim().toLowerCase(), s: facts.styles.map((x) => x.trim().toLowerCase()).filter(Boolean).sort() }));
}

/**
 * QA 3:26 AM #3: once a body title is shown it stays until the student locks a new choice.
 * A refinement (model titles, a re-planned shape) may fill a blank title, never replace one.
 */
export function keepShownTitles(prev: ShapeOutline | null | undefined, next: ShapeOutline, factsKey: string): ShapeOutline {
  if (!prev?.titles.length || (prev.factsKey && prev.factsKey !== factsKey)) return { ...next, factsKey };
  const titles = next.titles.map((t, i) => {
    const shown = prev.titles.find((x) => x.key === t.key) ?? prev.titles[i];
    return shown?.title && shown.fixed !== false ? { ...t, title: shown.title, fixed: true } : t;
  });
  for (const [i, p] of prev.titles.entries()) if (p.title && p.fixed !== false && !titles.some((t) => t.key === p.key) && i >= titles.length) titles.push(p);
  return { ...next, titles, factsKey };
}

const lowerStyle = (s: string) => (/^[A-Z][a-z]+(?:[- ][a-z]+)*$/.test(s) ? s.toLowerCase() : s);

/**
 * Rules fallback for ghost #2 (QA 1:11 AM #1): titles from their CHOICES (leader, styles),
 * never the first words of a note. "Body 1 – Sam Walton, servant", "Body 2 – Sam Walton, transformational".
 */
export function ruleOutline(shape: PaperShape, facts: OutlineFacts): ShapeOutline {
  const body = shape.blocks.filter((b) => b.group === "body");
  const styles = facts.styles.map(lowerStyle);
  if (!facts.leader && !styles.length) return { v: 1, titles: [], source: "rules" };
  const titles = body.map((b, i) => {
    const style = styles[i] ?? (styles.length === 1 && i === 0 ? styles[0] : null);
    const job = style ? null : clean(b.sub.split(/\s*[:(–—-]\s*/)[0] ?? b.sub, 40);
    // A theory, reading or counterargument paragraph is about the idea, not the leader.
    const aboutIdea = Boolean(job) && /\b(theor|reading|northouse|goleman|counter|limit|research|definition|framework|model)\w*/i.test(job!);
    const parts = [aboutIdea ? null : facts.leader, style ? `${style}${/leader|style/i.test(style) ? "" : " leadership"}` : job].filter((x): x is string => Boolean(x));
    // A title from their pick (or a real shape) stays once shown; a stand-in shape's placeholder can still improve.
    return { key: b.key, title: cleanTitle(parts.join(", ")), ideaRefs: [] as number[], fixed: Boolean(style) || shape.source === "model" };
  });
  return { v: 1, titles: titles.filter((t) => t.title), source: "rules" };
}

export const OUTLINE_SYSTEM = `You label the body paragraphs of a student's paper plan with short titles, using ONLY the student's own choices and notes. You never write any part of the paper.
Return JSON only: {"titles":[{"title":"...","ideas":[0,2]}]} with one entry per body paragraph, in order.
- title: 3 to 7 words, comma-separated parts: their leader or example, the style or idea that paragraph shows, and (if their notes give one) the example in 1 to 3 words. E.g. "Sam Walton, transformational vision", "Sam Walton, servant leadership, listening to associates", "Legere, winners circle, culture change". Each part is a complete noun phrase; never end on a word like "of", "the" or "a". No sentences, no claims, no new facts, nothing the student didn't choose or write.
- ideas: indexes of the student's body notes that belong in that paragraph (may be empty).`;

/** The client view: labels, subheadings and short titles only. */
export function projectSkeleton(shape: PaperShape, outline: ShapeOutline | null): SkeletonView {
  const byKey = new Map((outline?.titles ?? []).map((t) => [t.key, t]));
  const body = shape.blocks.filter((b) => b.group === "body");
  const transitions = body.slice(1).map((b, i) => `Transition – from ${body[i]!.sub} to ${b.sub}`).slice(0, shape.transitions);
  return {
    blocks: shape.blocks.map((b) => ({
      key: b.key,
      group: b.group,
      label: b.label,
      sub: b.sub,
      title: byKey.get(b.key)?.title ?? null,
      ideaRefs: byKey.get(b.key)?.ideaRefs ?? [],
    })),
    transitions,
    source: outline?.source === "model" || shape.source === "model" ? "model" : "rules",
  };
}

/** Short stable hash for "did the inputs change?" (not security). */
export function inputHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
