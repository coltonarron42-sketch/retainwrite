/**
 * PC-29b (QA prod smoke, qa7 b26087b1): the plain-words read-back never invents a restriction
 * ("using only Chapter 4…") the sheet doesn't state, the "graded on" line is always a sentence,
 * and the Stage 2 "It has to include" list skips what the sentence above it already names.
 * // SOP: coaching only, never generate submission text
 */

const RESTRICT = /\b(only|exclusively|solely|no other|nothing (?:but|else)|just)\b/i;

/** "using only Chapter 4 … and the Goleman article" → "using Chapter 4 … and the Goleman article", unless the sheet itself restricts. */
export function dropInventedRestriction(text: string, sheet: string): string {
  if (!text) return text;
  if (RESTRICT.test(sheet.replace(/\bnot only\b/gi, ""))) return text;
  return text
    .replace(/\b(?:only|exclusively|solely|just)\s+(?=(?:use|using|from|with|draw|rely|cite|citing|the|your|chapter|ch\.|[A-Z0-9]))/g, "")
    .replace(/\b(using|use|draw(?:ing)? on|rel(?:y|ying) on|cit(?:e|ing)|from|with)\s+(?:only|exclusively|solely|just)\s+/gi, "$1 ")
    .replace(/,?\s*and no other (?:sources?|readings?|materials?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const VERB_START = /^(?:argues?|uses?|explains?|includes?|shows?|demonstrates?|supports?|cites?|follows?|applies|apply|analy[sz]es?|compares?|describes?|identifies|identify|meets?|addresses|address|presents?|provides?|takes?|makes?|connects?|discuss(?:es)?|evaluates?|integrates?|defends?|develops?|states?|answers?|backs?|ties?|picks?|chooses?|stays?|is|has|gives?)\b(?!\s+of\b)/i;

const joinAnd = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs.at(-1)}`);

/**
 * "It's graded on argues which…" (garbled) → "It's graded on how well it argues which … and uses the required sources."
 * Noun phrases stay as they are ("thesis clarity, use of evidence").
 */
export function gradedSentence(items: string[]): string {
  const xs = items.map((x) => x.replace(/\s+/g, " ").replace(/[.;,\s]+$/, "").trim()).filter(Boolean);
  if (!xs.length) return "";
  const lower = (x: string) => (/^[A-Z][a-z]/.test(x) && !/^[A-Z][a-z]+\s+[A-Z]/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x);
  const verbs = xs.filter((x) => VERB_START.test(x)).map(lower);
  const nouns = xs.filter((x) => !VERB_START.test(x)).map(lower);
  const parts = [...(nouns.length ? [joinAnd(nouns)] : []), ...(verbs.length ? [`how well it ${joinAnd(verbs)}`] : [])];
  return `It's graded on ${parts.join(", and on ")}.`;
}

const STOP = new Set(["the", "and", "your", "you", "for", "with", "from", "that", "this", "assigned", "article", "chapter", "book", "textbook", "format", "example", "examples", "one", "of", "a", "an", "as", "in", "on", "to", "by"]);

/** The must-include items the sentence doesn't already name (its sources, its "one real leader"). */
export function notAlreadyNamed(items: string[], sentence: string): string[] {
  const words = new Set(sentence.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean));
  return items.filter((item) => {
    const raw = item.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
    const caps = raw.slice(1).filter((w) => /^[A-Z0-9]/.test(w)).concat(/^[A-Z][a-z]+$/.test(raw[0] ?? "") && !STOP.has((raw[0] ?? "").toLowerCase()) ? [raw[0]!] : []);
    const hitCaps = caps.filter((w) => words.has(w.toLowerCase()) || words.has(`${w.toLowerCase()}s`));
    if (caps.length >= 2) return hitCaps.length < 2;
    const content = raw.map((w) => w.toLowerCase()).filter((w) => w.length >= 3 && !STOP.has(w));
    if (!content.length) return true;
    const hit = content.filter((w) => words.has(w)).length;
    return hit / content.length < 0.6;
  });
}

const GRADE_WORDS = /\b(rubric|grad(?:e|ed|ing)|points?|pts|percent|%|criteria|criterion|assess(?:ed|ment)?|evaluat(?:ed|ion)|scor(?:e|ed|ing)|marks?)\b/i;
const FILLER = new Set(["how", "well", "it", "its", "the", "a", "an", "and", "of", "on", "to", "in", "your", "you", "for", "with", "use", "uses", "using", "is", "are", "be", "clear", "clarity", "quality", "overall", "strong", "good"]);
const content = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !FILLER.has(w));
const stem = (w: string) => w.replace(/(?:ments?|ing|ed|es|s)$/, "");

/**
 * QA (Nov 25): the read-back never invents grading criteria ("graded on length… and how well it
 * argues"). "Graded" lines survive only when the sheet itself talks about grading (a rubric,
 * points, criteria), and each one's content words must come from the sheet.
 */
export function groundedGraded(items: string[], sheet: string, hasRubric: boolean): string[] {
  if (!hasRubric && !GRADE_WORDS.test(sheet)) return [];
  const words = new Set(content(sheet).map(stem));
  return items.filter((item) => {
    const c = content(item);
    if (!c.length) return false;
    return c.filter((w) => words.has(stem(w))).length / c.length >= 0.75;
  });
}
