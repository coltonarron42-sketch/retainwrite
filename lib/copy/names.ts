/** QA 6:53 PM (qa8 b3d40615): names typed in lowercase ("satya Nadella") read back capitalized. */

/** "Satya Nadella" from "satya nadella", keeping inner capitals ("McDonald"). */
export function titleName(name: string): string {
  return name.replace(/\s+/g, " ").trim().split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

/** A short name fragment their answer opens with ("satya Nadella. I like…"): 2-3 words, one capitalized. */
export function leadingName(said: string): string | null {
  const first = said.split(/[.!?;:,]/)[0]?.trim() ?? "";
  const words = first.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return null;
  if (!words.some((w) => /^[A-Z][a-z'’-]+$/.test(w))) return null;
  if (words.some((w) => /^(i|my|the|a|an|is|was|he|she|they|like|think|pick|want|because|leadership|servant|transformational|situational)$/i.test(w))) return null;
  return titleName(words.join(" "));
}

