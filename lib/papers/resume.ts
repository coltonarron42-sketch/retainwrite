export type ResumePointer = {
  stage: number;
  sectionKey?: string | null;
  questionId?: string | null;
  screen?: string | null;
};

export function continueHref(paper: {
  id: string;
  current_stage: number;
  resume?: ResumePointer | null;
}): string {
  const stage = paper.resume?.stage;
  const safeStage = stage && stage >= 1 && stage <= 6 ? stage : paper.current_stage;
  const params = new URLSearchParams();
  if (paper.resume?.sectionKey) params.set("section", paper.resume.sectionKey);
  if (paper.resume?.questionId) params.set("question", paper.resume.questionId);
  if (paper.resume?.screen) params.set("screen", paper.resume.screen);
  const query = params.toString();
  return `/app/papers/${paper.id}/stage/${safeStage}${query ? `?${query}` : ""}`;
}

export const DRAFT_SAVE_DELAY_MS = 2000;
