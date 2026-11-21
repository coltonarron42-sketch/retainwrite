import { wordCount } from "@/lib/utils";

const STOCK = new Set([
  "idk",
  "i don't know",
  "not sure",
  "whatever",
  "n/a",
  "na",
  "none",
  "nothing",
  "yes",
  "no",
]);

export type ThinResult = {
  thin: boolean;
  reason?: "short" | "stock" | "repeat";
};

export function isThinAnswer(
  answer: string,
  minWords: number,
  question?: string,
): ThinResult {
  const trimmed = answer.trim();
  const words = wordCount(trimmed);
  if (words < minWords) return { thin: true, reason: "short" };
  if (STOCK.has(trimmed.toLowerCase())) return { thin: true, reason: "stock" };
  if (question) {
    const q = question.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const a = trimmed.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (a === q || (q.length > 10 && a.includes(q))) {
      return { thin: true, reason: "repeat" };
    }
  }
  return { thin: false };
}

const FILLER_START = /^(?:idk|i don't know|i dont know|not sure|whatever)\b/i;

/** A thin note gets a question, not a rejection and not a saved answer. */
export function probeForThinNote(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (FILLER_START.test(trimmed) || isThinAnswer(trimmed, 1).reason === "stock" || wordCount(trimmed) < 3) {
    return "What is one specific point you want this section to make?";
  }
  return null;
}

/** Drop stock phrases, one-word notes, and "idk ..." so they are not the official note. */
export function keptIdeas(ideas: string[]): string[] {
  return ideas.map((idea) => idea.trim()).filter((idea) => idea && !probeForThinNote(idea));
}
