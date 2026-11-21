// SOP: coaching only, never generate submission text
// Signals are ids and numbers. They never include a sentence for the student.

import { wordCount } from "@/lib/utils";
import type { ReadbackSignal } from "@/lib/drafting/readback";

const HEAVY_WORDS = 40;
const MAX_FLAGS = 2;

export function hiddenSignalsFromIdeas(
  ideas: { id: string; text: string; sectionKey: string }[],
): ReadbackSignal[] {
  const signals: ReadbackSignal[] = [];
  ideas.forEach((idea, index) => {
    if (signals.length >= MAX_FLAGS) return;
    if (wordCount(idea.text) < HEAVY_WORDS) return;
    signals.push({
      ideaId: idea.id,
      sectionKey: idea.sectionKey,
      confidence: 0.8,
      weight: "heavy",
      planRow: index + 1,
    });
  });
  return signals;
}
