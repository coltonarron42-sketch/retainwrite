/**
 * Which Pau Pau bubble is being read aloud right now? The speech queue says
 * the exact sentence (from the utterance's start event); a bubble matches when
 * that sentence's first words are in its text. Pure, so it is unit-tested.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bpow pow\b/g, "pau pau")
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function bubbleIsSpeaking(bubbleText: string, sentence: string | null): boolean {
  if (!sentence || !bubbleText) return false;
  const said = words(sentence).filter((w) => w.length >= 3).slice(0, 5);
  if (said.length === 0) return false;
  const have = new Set(words(bubbleText));
  return said.every((w) => have.has(w));
}

/** Plain text of bubble content (strings only; rich content is skipped). */
export function plainText(nodes: unknown[]): string {
  return nodes.filter((n): n is string | number => typeof n === "string" || typeof n === "number").join(" ");
}
