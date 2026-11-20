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
