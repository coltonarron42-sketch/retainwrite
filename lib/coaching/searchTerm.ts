/**
 * A natural library search query for one Stance section (QA 2:31 #3c):
 * 2-6 words built from the topic plus the section's focus, e.g. "teen sleep
 * and school start times". The model writes it (MODEL_FAST, low effort,
 * strict JSON); the keyword builder in exampleLeads is the fallback.
 * // SOP: coaching only — a search query, never submission text
 */
export const SEARCH_TERM_SYSTEM = `You write one library search query for a student's research.
Input: the assignment topic, the paper section, and the student's note for that section.
Return a natural research query of 2 to 6 words that a librarian would type into JSTOR, e.g. "teen sleep and school start times" or "later school start academic performance".
Rules: noun phrases only; no first person; no question; no quotes; no filler words at the end ("about", "part", "best", "things"); never copy a sentence or fragment of the student's note; no punctuation except "and".
Never write or suggest sentences for the paper.`;

export const SEARCH_TERM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { query: { type: "string" } },
  required: ["query"],
} as const;

const BAD_WORD = /\b(i|me|my|we|our|you|your|should|would|could|think|feel|because|so|best|part|about|things?|stuff|really|very)\b/i;
const BAD_TAIL = /\b(and|or|of|for|to|in|on|the|a|an|about|part|best|first|teen|teens|student|students)$/i;

/** A usable query: 2-6 words, letters/digits/spaces/hyphens only, no filler. */
export function isCleanQuery(q: string): boolean {
  const t = q.trim();
  if (!/^[a-z0-9][a-z0-9 \-']*$/i.test(t)) return false;
  const n = t.split(/\s+/).length;
  if (n < 2 || n > 6) return false;
  return !BAD_WORD.test(t) && !BAD_TAIL.test(t);
}

export function parseSearchTerm(raw: unknown): string | null {
  const v = raw && typeof raw === "object" ? (raw as { query?: unknown }).query : undefined;
  if (typeof v !== "string") return null;
  const q = v.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.?!]+$/, "");
  return isCleanQuery(q) ? q : null;
}
