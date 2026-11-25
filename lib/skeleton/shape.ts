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
  /** What Pau Pau needs the student to decide (server-side only; never rendered). */
  decisions: string[];
  source: "model" | "rules";
};

/** Ghost #2: one short title per body paragraph and which of the student's body notes it uses. */
export type ShapeOutline = { v: 1; titles: { key: string; title: string; ideaRefs: number[] }[]; source: "model" | "rules" };

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
    .array(z.object({ focus: z.string().min(2).max(120), kind: z.string().max(40).optional() }))
    .min(BODY_MIN)
    .max(BODY_MAX),
  transitions: z.number().int().min(0).max(20).optional(),
  examples: z.number().int().min(0).max(20).optional(),
  theories: z.number().int().min(0).max(10).optional(),
  decisions: z.array(z.string().max(160)).max(6).optional(),
});

/** A model shape, checked and capped. Labels stay generic (no names: it's shape only). */
export function shapeFromModel(raw: unknown): PaperShape | null {
  const parsed = modelShapeSchema.safeParse(raw);
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
- body: one entry per body paragraph, in order. Size it to the assignment's length (about 250 words per body paragraph; a 10-page paper has many more than a 2-page one) and to what it requires (named examples, theories, styles, counterarguments).
- focus: 2 to 6 generic words naming the paragraph's job, lowercase, no names, no claims, no sentences (e.g. "leadership example 2", "tie in the theory", "counterargument").
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

export function outlineFromModel(raw: unknown, shape: PaperShape, bodyNotes: number): ShapeOutline | null {
  const parsed = modelOutlineSchema.safeParse(raw);
  if (!parsed.success) return null;
  const body = shape.blocks.filter((b) => b.group === "body");
  const titles = body.map((b, i) => {
    const m = parsed.data.titles[i];
    return {
      key: b.key,
      title: m ? titleSafe(m.title) : "",
      ideaRefs: (m?.ideas ?? []).filter((n) => n < bodyNotes),
    };
  });
  return { v: 1, titles: titles.filter((t) => t.title), source: "model" };
}

/** Rules fallback for ghost #2: titles from the student's own body notes (first words). */
export function ruleOutline(shape: PaperShape, bodyNotes: string[]): ShapeOutline {
  const body = shape.blocks.filter((b) => b.group === "body");
  const titles = bodyNotes.slice(0, body.length).map((note, i) => ({
    key: body[i]!.key,
    title: titleSafe(note.split(/(?<=[.!?])\s/)[0] ?? note).split(/\s+/).slice(0, 7).join(" "),
    ideaRefs: [i],
  }));
  return { v: 1, titles: titles.filter((t) => t.title), source: "rules" };
}

export const OUTLINE_SYSTEM = `You label the body paragraphs of a student's paper plan with short titles, using ONLY the student's own choices and notes. You never write any part of the paper.
Return JSON only: {"titles":[{"title":"...","ideas":[0,2]}]} with one entry per body paragraph, in order.
- title: 3 to 8 words, like "Legere, winners circle, culture change". Names and topics the student chose, comma-separated. No sentences, no claims, no new facts.
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
