/** First unanswered question, or the plan length when every question is saved. */
export function resumeQuestionIndex(planIds: string[], answeredIds: string[]): number {
  const answered = new Set(answeredIds);
  const next = planIds.findIndex((id) => !answered.has(id));
  return next === -1 ? planIds.length : next;
}
