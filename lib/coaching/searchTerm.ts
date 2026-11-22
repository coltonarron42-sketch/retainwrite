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

/**
 * All sections in ONE call when Stage 2 loads (QA 3:35 C), so each section's
 * query is ready before its leads show and nothing visibly swaps.
 */
export const SEARCH_TERMS_SYSTEM = `You write library search queries for a student's research, one per paper section.
Input: the assignment topic and a list of sections (key, title, what the section needs).
For every section return a natural research query of 2 to 6 words that a librarian would type into JSTOR, built from the topic plus that section's focus, e.g. "teen sleep and school start times" or "later school start academic performance".
Rules: noun phrases only; no first person; no question; no quotes; no filler words at the end ("about", "part", "best", "things"); no punctuation except "and". Keep every query on the assignment topic.
Never write or suggest sentences for the paper.`;

export const SEARCH_TERMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    queries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { key: { type: "string" }, query: { type: "string" } },
        required: ["key", "query"],
      },
    },
  },
  required: ["queries"],
} as const;

/** Clean queries by section key; unknown keys and rejected queries are dropped. */
export function parseSearchTerms(raw: unknown, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const list = raw && typeof raw === "object" ? (raw as { queries?: unknown }).queries : undefined;
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const key = (item as { key?: unknown }).key;
    if (typeof key !== "string" || !keys.includes(key) || key in out) continue;
    const q = parseSearchTerm(item);
    if (q) out[key] = q;
  }
  return out;
}
