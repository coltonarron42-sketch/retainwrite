export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function commitSentence(existing: string[], next: string): string[] {
  const parts = splitSentences(next);
  if (parts.length === 0) return existing;
  return [...existing, ...parts];
}
