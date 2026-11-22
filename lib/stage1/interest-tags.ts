/**
 * Interest tags for personalization. Never infer sensitive categories.
 * Volunteered sensitive content may be used on this paper only — not promoted to standing tags.
 */

const SENSITIVE_PATTERNS = [
  /\b(?:gay|lesbian|bisexual|trans(?:gender)?|queer|lgbtq?)\b/i,
  /\b(?:christian|muslim|jewish|hindu|buddhist|atheist|religion)\b/i,
  /\b(?:democrat|republican|liberal|conservative|maga)\b/i,
  /\b(?:disabled|disability|autism|adhd|depression|anxiety disorder)\b/i,
  /\b(?:race|racist|black|white|asian|latino|latina|hispanic)\b/i,
];

const STOP_TAG_WORDS = new Set([
  "i",
  "me",
  "my",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "about",
  "like",
  "really",
  "just",
  "very",
  "idk",
  "dont",
  "don't",
]);

export function containsSensitiveContent(text: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(text));
}

/** Standing tags: short topical phrases; never sensitive inferences. */
export function extractInterestTags(answers: string[]): string[] {
  const tags = new Set<string>();

  for (const answer of answers) {
    const trimmed = answer.trim();
    if (!trimmed || containsSensitiveContent(trimmed)) continue;

    // Prefer quoted interests / "I love X" / "into X"
    const love = trimmed.match(
      /\b(?:i(?:'m| am)?\s+(?:into|interested in)|i (?:really )?(?:love|like|follow|play|watch)|fan of)\s+([^,.!?;:]{3,80})/i,
    );
    if (love) {
      // First item only, whole words: "soccer and baking sourdough with my cousin" → "soccer".
      const first = love[1]!.split(/\s+(?:and|with|because|but|or|when|since|so)\s+/i)[0]!.trim();
      const tag = normalizeTag(first.split(/\s+/).slice(0, 3).join(" "));
      if (tag) tags.add(tag);
      continue;
    }

    // Fallback: first content-ish phrase under 4 words
    const words = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP_TAG_WORDS.has(w));
    if (words.length >= 1 && words.length <= 4) {
      const tag = normalizeTag(words.slice(0, 3).join(" "));
      if (tag) tags.add(tag);
    }
  }

  return [...tags].slice(0, 12);
}

function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (tag.length < 2 || tag.length > 40) return null;
  if (containsSensitiveContent(tag)) return null;
  return tag;
}
