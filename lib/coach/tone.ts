/**
 * Pau Pau's written tone rules (Colton, Nov 22 4:00 PM): casual contractions,
 * short sentences, a relaxed rhythm, never stiff or polished. Used by the unit
 * tests that lock the template copy, and safe to run on any of her lines.
 */
export const STIFF_PHRASES: RegExp[] = [
  /\bcertainly\b/i,
  /\bI'?d be (happy|glad|delighted) to\b/i,
  /\bgreat question\b/i,
  /\bfurthermore\b/i,
  /\bmoreover\b/i,
  /\butili[sz]e\b/i,
  /\bin order to\b/i,
  /\bplease note\b/i,
  /\bkindly\b/i,
  /\bshall we\b/i,
  /\bit is (important|essential|crucial)\b/i,
  /\bdo not hesitate\b/i,
];

/** Spelled-out forms she'd naturally contract. */
export const UNCONTRACTED: RegExp[] = [
  /\b(you|we|they) are\b/i,
  /\bI am\b/,
  /\b(it|that|what|there) is\b/i,
  /\blet us\b/i,
  /\b(do|does|did|is|are|was|can|could|would|should|will) not\b/i,
  /\bI (will|would|have)\b/,
];

export const MAX_SENTENCE_WORDS = 22;

export function toneIssues(text: string): string[] {
  const issues: string[] = [];
  for (const re of STIFF_PHRASES) if (re.test(text)) issues.push(`stiff: ${re.source}`);
  for (const re of UNCONTRACTED) if (re.test(text)) issues.push(`uncontracted: ${re.source}`);
  for (const s of text.split(/(?<=[.?!])\s+/)) {
    const n = s.split(/\s+/).filter(Boolean).length;
    if (n > MAX_SENTENCE_WORDS) issues.push(`long sentence (${n} words): ${s.slice(0, 40)}`);
  }
  return issues;
}
