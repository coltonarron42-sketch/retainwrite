// SOP: coaching only, never generate submission text

import { isVerbatimSubstring } from "@/lib/coaching/lesson";
import { wordCount } from "@/lib/utils";

export function mirrorQuestion(emotionalTerms: string[], assignmentText: string): string {
  const term = emotionalTerms.find((item) => isVerbatimSubstring(item, assignmentText));
  if (!term) return "What feeling is this prompt asking you to capture?";
  return `Your prompt says “${term}.” What does ${term} mean to you?`;
}

export const MEMORY_PROBE_OPENER =
  "Do you already have a moment in mind for this section, or do you want me to ask a few questions to jog your memory?";

export const LESSON_PROBE_OPENER =
  "New section, fresh start. Do you already have an idea of how you want this section to go, or do you want me to ask some probing questions so we can start finding research?";

export const MEMORY_CONFIRM = "Are you comfortable moving forward with this moment?";

export function initialSearchStatus(
  mode: "lesson" | "memory",
  rubricRequiresSources: boolean,
): "required" | "not_needed" {
  if (mode === "memory" && !rubricRequiresSources) return "not_needed";
  return "required";
}

export type MemoryCard = {
  moment: string;
  details: string[];
  why: string;
};

export function buildMemoryCard(input: {
  moment: string;
  details: string[];
  why: string;
  studentText: string;
  term?: string | null;
}): { ok: true; card: MemoryCard } | { ok: false; reason: string } {
  const phrases = [input.moment, ...input.details, input.why].filter((item) => item.trim());
  for (const phrase of phrases) {
    if (wordCount(phrase) > 30) return { ok: false, reason: "phrase over 30 words" };
    if (!isVerbatimSubstring(phrase, input.studentText)) {
      return { ok: false, reason: "phrase is not the student's words" };
    }
  }
  return {
    ok: true,
    card: {
      moment: input.moment.trim(),
      details: input.details.map((item) => item.trim()).filter(Boolean).slice(0, 4),
      why: input.why.trim(),
    },
  };
}

export function memoryWhyQuestion(term: string | null): string {
  if (!term) return "Why did this moment matter to you?";
  return `Why did it feel ${term}?`;
}
