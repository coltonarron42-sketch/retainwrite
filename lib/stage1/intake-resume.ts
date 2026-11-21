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
  if (!input.voiceOk) reasons.push(input.voiceReason ?? "The voice sample is still short.");
  if (!input.stanceOk) reasons.push("Save an early stance of at least 25 words.");
  return reasons;
}
