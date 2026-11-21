// SOP: coaching only, never generate submission text

import type { IntroVariant } from "@/lib/coaching/introFormats";

export type PaperGenre =
  | "narrative"
  | "personal_experience"
  | "reflective"
  | "admissions"
  | "expository"
  | "argumentative"
  | "compare_contrast"
  | "cause_effect"
  | "literary_analysis"
  | "rhetorical_analysis"
  | "research"
  | "case_study"
  | "critique"
  | "unknown";

const STORY = new Set(["narrative", "personal_experience", "admissions"]);

export function variantForGenre(genre: PaperGenre): IntroVariant {
  if (STORY.has(genre)) return "story";
  if (genre === "reflective") return "reflective";
  if (genre === "case_study") return "case";
  return "thesis";
}

export function variantFromPromptType(
  promptType: "lesson" | "personal_experience" | "mixed",
  sectionMode?: "lesson" | "memory",
): IntroVariant {
  if (promptType === "personal_experience") return "story";
  if (promptType === "mixed" && sectionMode === "memory") return "story";
  return "thesis";
}
