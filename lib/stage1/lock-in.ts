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

export type ReadingFields = { type: string | null; title: string | null; author: string | null; chapter: string | null; source?: string | null; asWritten?: string | null };

/** Type, title and author out of one assigned-reading item, however the parse worded it. */
export function readingFields(item: string): ReadingFields | null {
  let t = item.replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, "");
  t = t.replace(/^(?:the|a|an|our|your)\s+(?:(?:assigned|required|attached|provided)\s+)?/i, "").replace(/^(?:assigned|required|attached|provided)\s+/i, "");
  // "The assigned chapter: Chapter 4 of …" / "The assigned article: ‘…’" (already pinned): read past the label.
  const pinned = /^(chapter|article|reading|handout|book|essay|textbook|report|case study)\s*:\s*/i.exec(t);
  if (pinned) t = t.slice(pinned[0].length);
  const tailSrc = /\s+\(([A-Z]{2,6})\)$/.exec(t);
  if (tailSrc) t = t.slice(0, tailSrc.index);
  // A chapter keeps the sheet's own wording: "Chapter 4 of Northouse, Leadership: Theory and Practice".
  const chap = /^(?:[Cc]hapter|[Cc]h\.?)\s*(\d{1,2})\b(.*)$/.exec(t);
  if (chap) {
    const rest = chap[2]!.replace(/^\s*\(([^)]*)\)/, " ($1)").trim();
    const author = /^(?:of|in|from)\s+(?:the\s+|our\s+)?(?:textbook\s+)?\(?([A-Z][\w-]+)(?:,|'s|’s|'|’)/.exec(rest)?.[1] ?? null;
    return { type: "chapter", chapter: chap[1]!, author, title: null, asWritten: `Chapter ${chap[1]}${rest ? ` ${rest}` : ""}`.replace(/\s+/g, " ").trim() };
  }
  // Title: the quoted part (straight or curly; a title's own apostrophe or "?" stays in it).
  const q = /(?<=^|[\s(])[“"‘']([^“”"]{3,120}?)[”"’'](?=\s|$|[,.;:)])/.exec(t);
  const title = q ? q[1]!.trim() : null;
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
  const typed = new RegExp(String.raw`^(${READING_TYPE})\b`, "i").exec(rest)?.[1] ?? (pinned && !/^chapter$/i.test(pinned[1]!) ? pinned[1]! : null);
  if (!typed && !title) return null;
  if (!typed && !author) return null;
  // "HBR article" → the type "article", the source "HBR" (shown after the author).
  const src = (typed ? /^([A-Z]{2,6})\s+/.exec(typed)?.[1] : null) ?? tailSrc?.[1] ?? null;
  const type = typed ? typed.replace(/^[A-Z]{2,6}\s+/, "").toLowerCase() : null;
  let ttl = title;
  if (!ttl && typed && !pinned) {
    const after = rest.slice(typed.length).replace(/^\s*(?:on|about|titled|called)\s+/i, "").trim();
    ttl = after && after.split(" ").length <= 12 ? after : null;
  }
  return { type, title: ttl, author, chapter: null, source: src };
}

/**
 * QA prod (after #81): "The assigned <type>: …", always. A chapter: "The assigned chapter: Chapter 4
 * of Northouse, Leadership: Theory and Practice". Anything else: "The assigned article: ‘What Makes a
 * Leader?’ by Daniel Goleman (HBR)". Gaps fall back gracefully; "The assigned" is never dropped.
 */
export function readingLabel(f: ReadingFields): string {
  if (f.chapter) return `The assigned chapter: ${f.asWritten ?? `Chapter ${f.chapter}`}`;
  const type = f.type ?? "reading";
  const title = f.title ? `‘${f.title.replace(/^['‘“"]|['’”"]$/g, "")}’` : "";
  const by = f.author ? `by ${f.author}` : "";
  const src = f.source ? `(${f.source})` : "";
  const what = [title, by, src].filter(Boolean).join(" ");
  if (!what) return `The assigned ${type}`;
  return title ? `The assigned ${type}: ${what}` : `The assigned ${type} ${what}`;
}

/**
 * A checklist item: an assigned reading is labeled from its fields (deterministic, whatever the
 * parse's wording); anything else (APA, length, a leader) keeps asOnSheet's rule. Never a leading
 * lowercase "the".
 */
export function checklistLabel(item: string, sheet: string): string {
  const f = readingFields(item);
  const out = f ? readingLabel(f) : asOnSheet(item, sheet);
  return out.replace(/^the\b/, "The");
}
