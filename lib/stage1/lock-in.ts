/**
 * QA full prod walk (qa4, paper 8979326a): what the student actually said is what gets locked in.
 * Leader and styles add up across every student turn ("Sam Walton… servant and transformational",
 * then "Yes, run with it! Although I also think the transformational side matters…"), a yes with
 * more after it is still a yes, and a reading counts as read only when they say they read it.
 * // SOP: coaching only, never generate submission text
 */
import { namedPerson } from "@/lib/stage1/north-turns";

const YES_HEAD = /^\s*(?:oh\s+|okay\s+|ok\s+)?(?:yes|yeah|yep|yup|sure|absolutely|definitely|ok(?:ay)?|sounds good|let'?s do (?:it|that)|let'?s go|let'?s run with it|run with it|that works|perfect|great|do it|love it)\b/i;

/**
 * "Yes, run with it! Although I also think…": the opening sentence is a short yes (no "no"/"not"),
 * and more follows. Returns what follows (their added thoughts), or null when it isn't a yes.
 */
export function yesWithMore(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(.*?[.!?])(?:\s+|$)(.*)$/) ?? [t, t, ""];
  const head = m[1]!;
  const rest = (m[2] ?? "").trim();
  // A bare "Okay." before a new story isn't a yes to the proposal.
  if (/^\s*(?:oh\s+)?(?:ok(?:ay)?|so|well)[.!?,]*\s*$/i.test(head)) return null;
  if (head.split(/\s+/).length > 8 || !YES_HEAD.test(head) || /\b(no|not|don'?t|nope|nah|wait)\b/i.test(head)) return null;
  // "Yes, but not servant…" turns the yes around: not a plain yes.
  if (/^(?:but|except|actually)\b[^.!?]*\b(?:not|no|instead|rather|change|switch|different)\b/i.test(rest)) return null;
  return rest;
}

/**
 * The leader they named in any turn ("I already said it, Sam Walton!"), first mention wins.
 * A name from the assignment sheet itself (the article's author, the professor) is never their leader.
 */
export function leaderAcross(texts: (string | null | undefined)[], sheet = ""): string | null {
  for (const t of texts) {
    const p = namedPerson(String(t ?? ""))?.replace(/['’]s$/i, "") ?? null;
    if (!p) continue;
    const last = p.split(/\s+/).at(-1)!;
    if (sheet && new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(sheet)) continue;
    return p;
  }
  return null;
}

/** Every student turn, once each, in order (the same text saved under two keys counts once). */
export function studentTurns(texts: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    const x = String(t ?? "").replace(/\s+/g, " ").trim();
    if (!x || out.some((o) => o === x || o.includes(x))) continue;
    // A longer text that already holds an earlier one replaces it.
    for (let i = out.length - 1; i >= 0; i--) if (x.includes(out[i]!)) out.splice(i, 1);
    out.push(x);
  }
  return out;
}

/** QA full prod walk (8979326a): long answers across turns never get "on the short side". */
export const LONG_ENOUGH_WORDS = 150;
export const longEnough = (words: number) => words >= LONG_ENOUGH_WORDS;

/** All the words they've written in Stage 1 so far, across turns. */
export function studentWordTotal(texts: (string | null | undefined)[]): number {
  return studentTurns(texts).reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0);
}

export { saidReadIt } from "@/lib/stage1/north-turns";

/**
 * QA prod smoke (51dddefe): a checklist item reads as the sheet says it ("The assigned HBR article
 * 'What Makes a Leader?' by Daniel Goleman"), never with its leading "The" / "the assigned" dropped.
 */
export function asOnSheet(item: string, sheet: string): string {
  const it = item.replace(/\s+/g, " ").trim();
  const sh = String(sheet ?? "").replace(/\s+/g, " ");
  if (!it || !sh || /^(?:the|a|an|our|your)\b/i.test(it)) return it;
  const head = it.split(" ").slice(0, 3).join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = sh.match(new RegExp(`\\b((?:the|our)\\s+(?:(?:assigned|required|attached|provided)\\s+)?)${head}`, "i"));
  if (!m) return it;
  const lead = m[1]!.trim().replace(/^our\b/i, "the");
  const rest = /^(?:assigned|required|attached|provided)\s/i.test(it) ? it : `${lead.split(" ").slice(1).join(" ")} ${it}`.trim();
  return `The ${rest}`.replace(/\s+/g, " ");
}

/* ---- QA (after #81, paper c09238f7): the checklist's reading label is built, not copied ---- */

const READING_TYPE = String.raw`(?:(?:[A-Z]{2,6}\s+)?(?:article|chapter|book|textbook|essay|handout|reading|case study|report|excerpt|piece|paper|book chapter|short story|poem|video|podcast))`;
const NAME = String.raw`(?:[A-Z][\w.'’-]*\s+){0,2}[A-Z][\w'’-]+`;

export type ReadingFields = { type: string | null; title: string | null; author: string | null; chapter: string | null };

/** Type, title and author out of one assigned-reading item, however the parse worded it. */
export function readingFields(item: string): ReadingFields | null {
  let t = item.replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, "");
  t = t.replace(/^(?:the|a|an|our|your)\s+(?:(?:assigned|required|attached|provided)\s+)?/i, "").replace(/^(?:assigned|required|attached|provided)\s+/i, "");
  // Title: the quoted part (straight or curly; a title's own apostrophe or "?" stays in it).
  const q = /(?<=^|[\s(])[“"‘']([^“”"]{3,120}?)[”"’'](?=\s|$|[,.;:)])/.exec(t);
  let title = q ? q[1]!.trim() : null;
  let rest = q ? `${t.slice(0, q.index)} ${t.slice(q.index + q[0].length)}`.replace(/\s+/g, " ").trim() : t;
  let author: string | null = null;
  const by = new RegExp(String.raw`\bby\s+(${NAME})`).exec(rest);
  if (by) {
    author = by[1]!.trim();
    rest = rest.replace(by[0], " ").replace(/\s+/g, " ").trim();
  }
  const poss = new RegExp(String.raw`^(${NAME})(?:'s|’s|s'|s’)\s+(?=${READING_TYPE}\b)`, "i").exec(rest);
  if (poss && !author) {
    author = poss[1]!.trim();
    rest = rest.slice(poss[0].length).trim();
  }
  // "Chapter 6 of Myers' Psychology (memory)"
  const chp = /^(?:[Cc]hapter|[Cc]h\.?)\s*(\d{1,2})\s+(?:of|in|from)\s+(?:the\s+|our\s+)?([A-Z][\w-]+)(?:'s|’s|'|’)\s+([A-Z][^()]*?)(?:\s*\([^)]*\))?$/.exec(rest);
  if (chp) return { type: "chapter", chapter: chp[1]!, author: author ?? chp[2]!, title: title ?? chp[3]!.trim() };
  // "Chapter 4 of Northouse, Leadership: Theory and Practice"
  const ch = /^(?:chapter|ch\.?)\s*(\d{1,2})\s+(?:of|in|from)\s+(?:the\s+|our\s+)?(?:textbook\s+)?\(?([A-Z][\w'’-]+),\s+([^()]+?)\)?$/i.exec(rest);
  if (ch) return { type: "chapter", chapter: ch[1]!, author: author ?? ch[2]!, title: title ?? ch[3]!.trim() };
  const type = new RegExp(String.raw`^(${READING_TYPE})\b`, "i").exec(rest)?.[1] ?? null;
  if (!type && !title) return null;
  if (!title && type) {
    const after = rest.slice(type.length).replace(/^\s*(?:on|about|titled|called)\s+/i, "").trim();
    title = after && after.split(" ").length <= 12 ? after : null;
  }
  if (!type && !author) return null;
  const typ = type ? type.replace(/^([A-Z]{2,6})\s+/, "$1 ").replace(/(\s|^)([A-Za-z][a-z ]+)$/, (m) => m.toLowerCase()) : null;
  return { type: typ, title, author, chapter: null };
}

/** "The assigned <type> '<title>' by <author>", with graceful gaps; never without "The assigned". */
export function readingLabel(f: ReadingFields): string {
  const type = f.type ?? "reading";
  const title = f.title ? `'${f.title.replace(/^['‘“"]|['’”"]$/g, "")}'` : "";
  if (f.chapter) return `The assigned chapter ${f.chapter} of ${title || "the textbook"}${f.author ? ` by ${f.author}` : ""}`.replace(/\s+/g, " ");
  return ["The assigned", type, title, f.author ? `by ${f.author}` : ""].filter(Boolean).join(" ");
}

/**
 * A checklist item: an assigned reading is labeled from its fields (deterministic, whatever the
 * parse's wording); anything else (APA, length, a leader) keeps asOnSheet's rule.
 */
export function checklistLabel(item: string, sheet: string): string {
  const f = readingFields(item);
  return f ? readingLabel(f) : asOnSheet(item, sheet);
}
