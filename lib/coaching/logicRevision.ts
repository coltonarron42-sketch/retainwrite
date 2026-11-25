// SOP: coaching only, never generate submission text

import {
  finalizeLogicCheck,
  logicCheckFromNotes,
  quoteOnWordBoundary,
  type FinalizedLogic,
} from "@/lib/coaching/logicCheck";
import { keptIdeas } from "@/lib/coaching/thin";

export { quoteOnWordBoundary };

/** Revise / Reframe / Pick a new angle open the current claim, not an empty box. */
export function revisionPrefill(ideas: string[]): string {
  return keptIdeas(ideas).at(-1) ?? ideas.map((idea) => idea.trim()).filter(Boolean).at(-1) ?? "";
}

/**
 * The new text replaces the claim being revised (the last kept note). The old wording of
 * THAT claim is not kept beside it, but every earlier note (their thesis) stays (QA 8:31 AM).
 */
export function replaceClaim(ideas: string[], next: string): string[] {
  const text = next.trim();
  const kept = keptIdeas(ideas);
  if (!text) return kept.slice(0, -1);
  return [...kept.slice(0, -1), text];
}

export function refreshStoredLogic(
  section: {
    ideas: string[];
    logic: FinalizedLogic | null;
    loopStep: string;
  },
  input: { assignmentText: string; rubricRef: string; mode: "lesson" | "memory" },
): { ideas: string[]; logic: FinalizedLogic | null } {
  const notes = keptIdeas(section.ideas).at(-1) ?? "";
  if (!notes) return { ideas: section.ideas, logic: null };
  const raw = logicCheckFromNotes({
    notes,
    assignmentText: input.assignmentText,
    rubricRef: input.rubricRef,
    mode: input.mode,
  });
  const logic = finalizeLogicCheck(raw, {
    assignmentText: input.assignmentText,
    studentNotes: notes,
    mode: input.mode,
    rubricRequiresCounterargument: false,
    validRubricRefs: [input.rubricRef, "prompt", "ethics", "lesson_concept"],
  });
  return { ideas: [notes], logic };
}
