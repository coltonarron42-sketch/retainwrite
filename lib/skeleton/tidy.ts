/**
 * PC-28 skeleton fix (after #82). Pure helpers, shared by the server (ghost.ts, the skeleton route) and tests:
 * - bodyPlan / fitBodies: how many body paragraphs a paper gets, and trimming a shape to it;
 * - shapeSigOf: which shape a set of body titles was made for (stale titles are never served);
 * - directionSummary: the skeleton's top line, synthesized from their locked choices;
 * - varyTitles: the leader's name on at most two body titles.
 */
import type { PaperShape, ShapeBlock, SkeletonView } from "@/lib/skeleton/shape";
import { BODY_MAX, BODY_MIN } from "@/lib/skeleton/shape";

/** Intro + conclusion, together. */
const FRAME_WORDS = 300;
/** A body paragraph: about 250-300 words. Sizing uses 300; a counterargument may take it down to 250. */
const BODY_WORDS = 300;
const BODY_FLOOR = 250;

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (s: string) => NUM[s.toLowerCase()] ?? Number(s);

/** A paragraph count the assignment states: "3 body paragraphs" → 3; "a five-paragraph essay" → 3 bodies. */
export function statedBodies(text: string | null | undefined): number | null {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const N = String.raw`(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)`;
  const body = new RegExp(String.raw`\b${N}\s+(?:main\s+)?body\s+paragraphs?\b`, "i").exec(t);
  if (body) return Math.max(1, Math.min(BODY_MAX, num(body[1]!)));
  const whole = new RegExp(String.raw`\b${N}[- ]paragraphs?\s+(?:essay|paper|response|argument)\b|\b(?:in|of|with)\s+${N}\s+paragraphs\b`, "i").exec(t);
  const n = whole ? num((whole[1] ?? whole[2])!) : NaN;
  return Number.isFinite(n) && n >= 3 ? Math.min(BODY_MAX, n - 2) : null;
}

/** The length range the sheet gives ("1,200-1,500 words", "4-5 pages"); one number is both ends. */
export function lengthRange(text: string | null | undefined, words?: number | null): { low: number; high: number } | null {
  const t = String(text ?? "").replace(/,/g, "");
  const w = /(\d{3,5})\s*(?:[-–—]|to)\s*(\d{3,5})\s*words?\b/i.exec(t) ?? /(\d{3,5})\s*words?\b/i.exec(t);
  if (w) return { low: Number(w[1]), high: Number(w[2] ?? w[1]) };
  const p = /(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\s*(?:-\s*)?pages?\b/i.exec(t) ?? /(\d{1,2})\s*(?:-\s*)?pages?\b/i.exec(t);
  if (p) return { low: Number(p[1]) * 275, high: Number(p[2] ?? p[1]) * 275 };
  return words ? { low: words, high: words } : null;
}

export type BodyPlan = { bodies: number; withCounter: number; stated: boolean };

/**
 * The sizing rule (PLAN.md has none): a stated paragraph count wins. Otherwise ~300 words per body
 * after ~300 for the intro and conclusion, sized from the low end of the range (what the paper has
 * to fill), plus one counterargument paragraph when the high end still leaves 250+ words a body.
 * 1,200-1,500 words → 3 bodies, or 4 with a counterargument.
 */
export function bodyPlan(input: { text?: string | null; words?: number | null }): BodyPlan {
  const stated = statedBodies(input.text);
  if (stated) return { bodies: stated, withCounter: stated, stated: true };
  const r = lengthRange(input.text, input.words);
  if (!r) return { bodies: 3, withCounter: 3, stated: false };
  const bodies = Math.min(BODY_MAX, Math.max(BODY_MIN, Math.round((r.low - FRAME_WORDS) / BODY_WORDS)));
  const room = (r.high - FRAME_WORDS) / (bodies + 1);
  return { bodies, withCounter: room >= BODY_FLOOR && bodies < BODY_MAX ? bodies + 1 : bodies, stated: false };
}

const COUNTER = /\bcounter|objection|other side|limitation|rebuttal/i;

/** A shape trimmed (or, for a stated count, padded) to the plan; bodies re-keyed body-1..n in order. */
export function fitBodies(shape: PaperShape, plan: BodyPlan): PaperShape {
  const bodies = shape.blocks.filter((b) => b.group === "body");
  const counter = bodies.find((b) => COUNTER.test(b.sub)) ?? null;
  const target = counter ? plan.withCounter : plan.bodies;
  let keep: ShapeBlock[] = bodies;
  if (bodies.length > target) {
    const rest = bodies.filter((b) => b !== counter);
    keep = counter ? [...rest.slice(0, target - 1), counter] : rest.slice(0, target);
  } else if (plan.stated && bodies.length < target) {
    keep = [...bodies];
    for (let i = bodies.length; i < target; i++) keep.push({ key: "", group: "body", label: "", sub: `main point ${i + 1}` });
  }
  if (keep === bodies && keep.every((b, i) => b.key === `body-${i + 1}`)) return shape;
  const rekeyed = keep.map((b, i) => ({ ...b, key: `body-${i + 1}`, label: `Paragraph ${i + 1}` }));
  return {
    ...shape,
    blocks: [...shape.blocks.filter((b) => b.group === "intro"), ...rekeyed, ...shape.blocks.filter((b) => b.group === "conclusion")],
    transitions: Math.min(shape.transitions, Math.max(1, rekeyed.length - 1)),
  };
}

export { shapeSigOf } from "@/lib/skeleton/shape";

const STYLE_LABEL = /^(servant|transformational|situational|transactional|authentic|democratic|behavioral|autocratic|laissez-faire|charismatic)$/i;
const andList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Their reason, tidied: the clause after "because/since", plain, short; never a quote or a thesis. */
export function reasonClause(said: string | null | undefined): string | null {
  const t = String(said ?? "").replace(/\s+/g, " ").trim();
  const m = /\b(?:because|since|as|cause|'cause)\s+(.+)$/i.exec(t);
  if (!m) return null;
  let r = m[1]!.split(/(?<=[.!?;])\s|\s+(?:and|but|so)\s+(?:also\s+)?(?:i|that's|thats|it's)\b/i)[0]!.replace(/[.!?;,\s]+$/, "").trim();
  r = r.replace(/^(?:i think|i guess|i feel like|like|basically|honestly)\s+/i, "").replace(/\b(?:really|kinda|kind of|sort of|just|like)\s+/gi, "");
  const words = r.split(" ").filter(Boolean);
  if (words.length < 2) return null;
  if (words.length > 10) r = words.slice(0, 10).join(" ").replace(/\s+(?:and|or|but|the|a|an|of|to|with|for|in|on)$/i, "");
  // First person about the paper ("I want to show…") is a plan, not a reason line.
  if (/^(?:i|we|my)\b/i.test(r)) return null;
  return r.charAt(0).toLowerCase() + r.slice(1);
}

/**
 * The skeleton's top line from their locked choices: "Sam Walton as a servant leader: he put associates
 * first". Built from the leader, the style(s) and a tidied reason; never their raw sentence, never ghost
 * text, never a thesis sentence. Null when they haven't chosen anything yet.
 */
export function directionSummary(input: { leader?: string | null; styles?: string[]; said?: string | null }): string | null {
  const styles = (input.styles ?? []).map((s) => s.trim()).filter(Boolean).map((s) => (STYLE_LABEL.test(s) ? s.toLowerCase() : s));
  const leader = input.leader?.trim() || null;
  const reason = reasonClause(input.said);
  const styleWords = andList(styles);
  const head = leader && styles.length
    ? `${leader} as a${/^[aeiou]/i.test(styleWords) ? "n" : ""} ${styleWords} leader`
    : leader
      ? `${leader} as your example`
      : styles.length
        ? `${styleWords.charAt(0).toUpperCase()}${styleWords.slice(1)} leadership`
        : null;
  if (!head) return null;
  return reason ? `${head}: ${reason}` : head;
}

/** QA (after #82): the leader's name opens at most two body titles; the rest say what the paragraph does. */
export function varyTitles(view: SkeletonView, leader: string | null | undefined, max = 2): SkeletonView {
  const name = leader?.trim();
  if (!name) return view;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lead = new RegExp(`^${esc}(?:'s|’s)?\\s*[,:–—-]\\s*`, "i");
  let seen = 0;
  return {
    ...view,
    blocks: view.blocks.map((b) => {
      if (b.group !== "body" || !b.title || !lead.test(b.title)) return b;
      seen++;
      if (seen <= max) return b;
      const rest = b.title.replace(lead, "").trim();
      if (rest.split(/\s+/).length < 2) return b;
      return { ...b, title: rest.charAt(0).toUpperCase() + rest.slice(1) };
    }),
  };
}
