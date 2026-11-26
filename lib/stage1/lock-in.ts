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

// QA prod smoke (after #83): the reading label lives in one module so every render path (the intake
// and the checklist lines themselves) goes through the same pin.
export { asOnSheet, checklistLabel, readingFields, readingLabel, type ReadingFields } from "@/lib/stage1/reading-label";
