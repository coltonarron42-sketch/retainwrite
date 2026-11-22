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

    // Prefer "I love X" / "into X"; otherwise read the whole answer as a list.
    const love = trimmed.match(
      /\b(?:i(?:'m| am)?\s+(?:into|interested in)|i (?:really )?(?:love|like|enjoy|follow|play|watch)|fan of)\s+([^.!?;:]{3,160})/i,
    );
    const listText = love ? love[1]! : trimmed;
    const found = interestItems(listText);
    if (found.length) {
      found.forEach((tag) => tags.add(tag));
      continue;
    }
    if (love) continue;

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

/** Things too generic to steer a lead ("hanging out", "my cousin Mia"). */
const GENERIC_ITEM =
  /^(hanging out|hang out|chilling|relaxing|spending time|having fun|friends?|family|people|stuff|things|everything|school|tv|music|games|sleeping|eating|going out|the show|my\b.*|a lot|lots)$/i;
const LEAD_VERB = /^(watching|watch|playing|play|listening to|following|doing|going to|reading|i\s+\w+)\s+/i;

/**
 * Split an answer into interest items and keep the specific ones, whole words:
 * "hanging out with my cousin Mia and baking sourdough, plus watching soccer"
 * → ["baking sourdough", "soccer"].
 */
export function interestItems(text: string): string[] {
  const out: string[] = [];
  const parts = text
    .split(/,|;|\s+(?:and|with|plus|also|or|but|because|when|since|so)\s+/i)
    .map((part) =>
      part
        .trim()
        .replace(/^(?:and|plus|also|then|i\s+(?:also\s+)?(?:like|love|enjoy))\s+/i, "")
        .replace(/^(?:the|a|an|some)\s+/i, "")
        .trim(),
    );
  for (const part of parts) {
    let item = part.replace(LEAD_VERB, "").replace(/^(?:the|a|an)\s+/i, "").trim();
    // Keep "baking sourdough" (activity + thing) but drop a bare lead verb like "watching soccer" → "soccer".
    if (!item) continue;
    item = item.split(/\s+/).slice(0, 3).join(" ");
    if (GENERIC_ITEM.test(item) || /\b(cousin|friend|mom|dad|brother|sister|grandpa|grandma)\b/i.test(item)) continue;
    if (item.split(/\s+/).every((w) => STOP_TAG_WORDS.has(w.toLowerCase()))) continue;
    const tag = normalizeTag(item);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (tag.length < 2 || tag.length > 40) return null;
  if (containsSensitiveContent(tag)) return null;
  return tag;
}
