export type ResumePointer = {
  stage: number;
  sectionKey?: string | null;
  questionId?: string | null;
  screen?: string | null;
  /** Client clock (ms) when this position was reached. */
  at?: number;
};

export function continueHref(paper: {
  id: string;
  current_stage: number;
  resume?: ResumePointer | null;
}): string {
  const resumeStage = paper.resume?.stage;
  const current = paper.current_stage;
  // Preserved gates: Continue always opens the paper's own stage, never one ahead.
  const safeStage = current;
  const params = new URLSearchParams();
  if (resumeStage === safeStage) {
    if (paper.resume?.sectionKey) params.set("section", paper.resume.sectionKey);
    if (paper.resume?.questionId) params.set("question", paper.resume.questionId);
    if (paper.resume?.screen) params.set("screen", paper.resume.screen);
  }
  const query = params.toString();
  return `/app/papers/${paper.id}/stage/${safeStage}${query ? `?${query}` : ""}`;
}

export const DRAFT_SAVE_DELAY_MS = 2000;
