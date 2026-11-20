import { WORDS_PER_PAGE_DOUBLE_SPACED } from "@/lib/config";
import type { LengthValue } from "@/lib/assignment/schema";

/**
 * Convert page counts to word estimates at 275 words/page (double-spaced).
 * Never overwrites an explicit word count.
 */
export function applyPageWordEstimates(length: LengthValue): LengthValue {
  const next: LengthValue = { ...length };
  const hasExplicitWords =
    typeof next.wordsMin === "number" || typeof next.wordsMax === "number";

  if (hasExplicitWords) {
    // Drop any prior estimates so they cannot compete with explicit words.
    delete next.wordsEstimateMin;
    delete next.wordsEstimateMax;
    return next;
  }

  if (typeof next.pagesMin === "number") {
    next.wordsEstimateMin = next.pagesMin * WORDS_PER_PAGE_DOUBLE_SPACED;
  }
  if (typeof next.pagesMax === "number") {
    next.wordsEstimateMax = next.pagesMax * WORDS_PER_PAGE_DOUBLE_SPACED;
  } else if (
    typeof next.pagesMin === "number" &&
    next.wordsEstimateMin !== undefined
  ) {
    next.wordsEstimateMax = next.wordsEstimateMin;
  }

  return next;
}

/** Midpoint used by Stage 3 for body-section N. Prefer explicit words over estimates. */
export function lengthMidpointWords(length: LengthValue | null | undefined): number | null {
  if (!length) return null;

  if (typeof length.wordsMin === "number" || typeof length.wordsMax === "number") {
    const min = length.wordsMin ?? length.wordsMax!;
    const max = length.wordsMax ?? length.wordsMin!;
    return Math.round((min + max) / 2);
  }

  if (
    typeof length.wordsEstimateMin === "number" ||
    typeof length.wordsEstimateMax === "number"
  ) {
    const min = length.wordsEstimateMin ?? length.wordsEstimateMax!;
    const max = length.wordsEstimateMax ?? length.wordsEstimateMin!;
    return Math.round((min + max) / 2);
  }

  return null;
}

export function formatLengthLabel(length: LengthValue | null | undefined): string {
  if (!length) return "Not specified";
  if (length.raw?.trim()) return length.raw.trim();

  if (typeof length.wordsMin === "number" || typeof length.wordsMax === "number") {
    const min = length.wordsMin ?? length.wordsMax;
    const max = length.wordsMax ?? length.wordsMin;
    return min === max ? `${min} words` : `${min}–${max} words`;
  }

  if (typeof length.pagesMin === "number" || typeof length.pagesMax === "number") {
    const min = length.pagesMin ?? length.pagesMax;
    const max = length.pagesMax ?? length.pagesMin;
    const pages = min === max ? `${min} pages` : `${min}–${max} pages`;
    const estMin = length.wordsEstimateMin ?? length.wordsEstimateMax;
    const estMax = length.wordsEstimateMax ?? length.wordsEstimateMin;
    if (estMin && estMax) {
      return `${pages} (~${estMin.toLocaleString()}–${estMax.toLocaleString()} words)`;
    }
    return pages;
  }

  return "Not specified";
}
