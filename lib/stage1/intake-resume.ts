/** First unanswered question, or the plan length when every question is saved. */
export function resumeQuestionIndex(planIds: string[], answeredIds: string[]): number {
  const answered = new Set(answeredIds);
  const next = planIds.findIndex((id) => !answered.has(id));
  return next === -1 ? planIds.length : next;
}

export type IntakeResume = {
  index: number;
  skipInterest: boolean;
  /** gate = early stance is already saved, so do not replay the questions. */
  screen: "coaching" | "gate" | "stay";
};

/** Reload should continue, not restart get-to-know-you after later answers exist. */
export function resumeIntake(planIds: string[], answeredIds: string[]): IntakeResume {
  const answered = new Set(answeredIds);
  if (answered.has("stance_early")) {
    return { index: planIds.length, skipInterest: false, screen: "gate" };
  }
  const later = ["bg_comfort", "coaching_take", "personal_1", "fallback_voice"].some((id) =>
    answered.has(id),
  );
  const hasInterest = planIds.some((id) => id.startsWith("interest_") && answered.has(id));
  const skipInterest = later && !hasInterest;
  const ids = skipInterest ? planIds.filter((id) => !id.startsWith("interest_")) : planIds;
  const index = resumeQuestionIndex(ids, answeredIds);
  return {
    index,
    skipInterest,
    screen: index < ids.length ? "coaching" : "stay",
  };
}

/** A refresh should reopen the question in progress, not the assignment checklist. */
export function intakeScreenAfterLoad(input: {
  resumeScreen?: string | null;
  resumeQuestionId?: string | null;
  hasAnswers: boolean;
}): "card" | "coaching" | "gate" | "story" | "stance" {
  if (input.resumeScreen === "gate") return "gate";
  // Typing the early take (draft autosave says "coaching"): reopen that box.
  if (input.resumeQuestionId === "stance_early") return input.resumeScreen === "coaching" ? "stance" : "gate";
  if (input.resumeScreen === "story") return "story";
  if (
    input.resumeScreen === "coaching" ||
    Boolean(input.resumeQuestionId) ||
    input.hasAnswers
  ) {
    return "coaching";
  }
  return "card";
}

/** Skip get-to-know-you must not throw away answers already counted in the voice sample. */
export function answersAfterSkippingInterest<T extends { kind: string }>(answers: T[]): T[] {
  return answers;
}

export function stanceStartBlockers(input: {
  checklistConfirmed: boolean;
  hasStory: boolean;
  voiceOk: boolean;
  voiceReason?: string;
  stanceOk: boolean;
}): string[] {
  const reasons: string[] = [];
  if (!input.checklistConfirmed) reasons.push("Confirm the assignment card first.");
  if (!input.hasStory) reasons.push("Pick a story angle first.");
  // Voice length is a warning, never a hard stop (PLAN.md): see voiceShortNote.
  if (!input.stanceOk) reasons.push("Add a couple more sentences to your early take.");
  return reasons;
}

/** Gentle note when the voice sample is short. The student can still continue. */
export function voiceShortNote(input: { voiceOk: boolean }): string | null {
  if (input.voiceOk) return null;
  return "Your answers are on the short side, so the coach has less of your voice to match. You can keep going now, or reopen an earlier answer and add a few sentences.";
}
