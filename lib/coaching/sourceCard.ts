// SOP: coaching only, never generate submission text

import { wordCount } from "@/lib/utils";

export type SourceCard = {
  claim: string;
  excerpt: string;
  location: string;
  whyFitsRubric: string;
  rubricRef: string;
  lessonLink: string;
};

export function lessonLinkFor(concept: string): string {
  return `Shows ${concept}`.split(/\s+/).filter(Boolean).slice(0, 12).join(" ");
}

export function guardSourceCard(card: SourceCard, sourceText: string): { ok: true } | { ok: false; reason: string } {
  if (!card.rubricRef.trim()) return { ok: false, reason: "rubricRef required" };
  if (wordCount(card.lessonLink) > 12) return { ok: false, reason: "lesson link over 12 words" };
  if (!sourceText.includes(card.excerpt.trim())) {
    return { ok: false, reason: "excerpt is not verbatim" };
  }
  return { ok: true };
}
