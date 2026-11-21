import type { ResumePointer } from "@/lib/papers/resume";

/** The in-progress field is the place a refresh should reopen. */
export function draftPointer(input: { stage: number; questionId?: string | null; sectionKey?: string | null }): ResumePointer {
  return {
    stage: input.stage,
    ...(input.questionId ? { questionId: input.questionId } : {}),
    ...(input.sectionKey ? { sectionKey: input.sectionKey } : {}),
    screen: input.stage === 1 ? "coaching" : input.stage === 3 ? "outline" : input.stage === 5 ? "draft" : "stance",
  };
}

export function restoreDraftText(
  drafts: { fieldKey: string; text: string }[],
  questionId: string,
): string {
  return drafts.find((row) => row.fieldKey === `stage1:${questionId}`)?.text ?? "";
}
