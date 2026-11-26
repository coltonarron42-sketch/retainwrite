/**
 * QA prod smoke (c7bd257, paper 64a5b2bd): "Servant, not transformational, because Walton put
 * associates first and didn't really sell a big vision." is ONE style. A style named only to set
 * it aside ("X, not Y", "not really Y", "rather than Y", "instead of Y", "less Y", "more X than Y",
 * "X over Y", "Y isn't it") is never one they chose: not in the reflection, the lock-in, the gate,
 * the skeleton titles or the saved pick. A style counts when at least one mention of it is not set aside.
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Words that may sit between the negator and the style ("not really the transformational kind").
const FILL = "(?:(?:really|so|very|much|actually|exactly|necessarily|quite|all|that|the|a|an|as|more|even|too|truly|totally|purely|mainly|mostly|so much|at all)\\s+){0,3}";
// "not just/only Y" and "no less Y" keep Y in.
const PRE = new RegExp(
  `(?:\\b(?:not|never|nor|isn'?t|aren'?t|wasn'?t|weren'?t|instead\\s+of|rather\\s+than|than|over|against|less|minus|except|without|no)|n't)\\s+${FILL}$`,
  "i",
);
const KEEP = /\b(?:not|n't)\s+(?:just|only|merely|simply)\s+(?:\w+\s+){0,2}$|\bno\s+less\s+$|\bnot\s+less\s+$/i;
const POST = /^(?:\s+(?:leadership|style|styles|leader|approach|side|one))?\s*,?\s*(?:isn'?t|is\s+not|wasn'?t|doesn'?t|does\s+not|didn'?t|won'?t|is\s+wrong|is\s+worse|falls\s+short|is\s+out|loses)\b(?!\s+(?:just|only|merely|always))/i;

/** One mention at `at` (length `len`) is set aside. */
function setAsideAt(text: string, at: number, len: number): boolean {
  const before = text.slice(Math.max(0, at - 60), at);
  const after = text.slice(at + len, at + len + 60);
  if (KEEP.test(before)) return false;
  return PRE.test(before) || POST.test(after);
}

/** Is `word` (a style or option word) named in `text` as one they chose? False when every mention sets it aside, or none. */
export function affirmsStyle(text: string, word: string): boolean {
  const re = new RegExp(`\\b${esc(word)}`, "gi");
  for (const m of String(text ?? "").matchAll(re)) {
    if (!setAsideAt(text, m.index ?? 0, m[0].length)) return true;
  }
  return false;
}

/** The style or option word is named somewhere, but only to set it aside. */
export function rejectsStyle(text: string, word: string): boolean {
  return new RegExp(`\\b${esc(word)}`, "i").test(String(text ?? "")) && !affirmsStyle(text, word);
}

/** The style words a reflection could name (kept in step with north-turns' KNOWN_STYLE). */
export const STYLE_WORDS = ["transformational", "transactional", "servant", "situational", "democratic", "autocratic", "authoritarian", "authentic", "charismatic", "laissez-faire", "participative", "adaptive", "visionary", "affiliative", "pacesetting"] as const;

/** The styles the student named only to set aside ("Servant, not transformational" → ["transformational"]). */
export function setAsideStyles(said: string): string[] {
  return STYLE_WORDS.filter((w) => rejectsStyle(said, w));
}

/**
 * QA retest (da13848, paper 8c1b541b): a reflection written by Pau (the PC-31 story turn) must keep
 * #75's rule: a style they set aside is never reflected back as theirs. True when `reply` names one
 * as chosen ("Walton, showing servant and transformational leadership").
 */
export function reflectsSetAside(reply: string, said: string): boolean {
  return setAsideStyles(said).some((w) => affirmsStyle(reply, w));
}
