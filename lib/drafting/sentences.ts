import { splitSentences } from "@/lib/text/sentences";

export { splitSentences };

export function commitSentence(existing: string[], next: string): string[] {
  const parts = splitSentences(next);
  if (parts.length === 0) return existing;
  return [...existing, ...parts];
}
