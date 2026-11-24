import { decisionHasReason, isSkipSaying } from "@/lib/stage1/paper-context";

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
  /**
   * North-star papers (Colton 12:04 AM): the advance check is clarify, catch up,
   * decide: a confirmed read-back, the catch-up offered or declined, and a chosen
   * direction with their reason. (The server's own gates still apply.)
   */
  northstar?: { catchUpDone: boolean; decided: boolean };
}): string[] {
  const reasons: string[] = [];
  if (!input.checklistConfirmed) reasons.push("Confirm the assignment card first.");
  if (input.northstar && !input.northstar.catchUpDone) reasons.push("Tell me whether you've read the material (or want the key points).");
  if (input.northstar && !input.northstar.decided) reasons.push("Pick a direction and tell me why.");
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

/**
 * North-star advance check from what they actually said (QA 6:03 AM): a skip
 * or an empty answer never counts, and a decision needs its reason.
 */
export function northstarGateFrom(input: {
  answers: { questionId: string; answerText: string; skipped?: boolean }[];
  decisionAnswer?: string | null;
  needsLeader?: boolean;
  leaderAnswer?: string | null;
  /** The summary was shown before the confirm (QA 7:02 AM). */
  materialShown?: boolean;
}): { catchUpDone: boolean; decided: boolean } {
  // A typed "skip" never counts toward the gate (QA 7:02 AM).
  const said = (id: string) =>
    input.answers.filter((a) => a.questionId === id && !a.skipped && a.answerText.trim() && !isSkipSaying(a.answerText)).map((a) => a.answerText.trim());
  const catchUpDone = Boolean(input.materialShown) || said("material_check").length > 0;
  // QA 10:21 walk C: the early take is their stance in their own words; its reason counts
  // for a decision they already made (never stands in for a missing pick).
  const hasPick = Boolean((input.decisionAnswer ?? "").trim()) || said("decision_pick").length > 0;
  const texts = [input.decisionAnswer ?? "", ...said("decision_pick"), ...said("decision_why"), ...(hasPick ? said("stance_early") : [])].filter(Boolean);
  const joined = [input.decisionAnswer ?? "", ...said("decision_why")].join(" ").trim();
  const hasReason = texts.some((t) => decisionHasReason(t)) || (joined ? decisionHasReason(joined) : false);
  // A leader already named in their own words ("using Satya Nadella at Microsoft") counts (QA 10:21 suite).
  const NOT_PERSON = /^(?:Transformational|Situational|Servant|Behavioral|Authentic|Leadership|Theory|Practice|Emotional|Intelligence|Chapter|What|Makes|The|This|I)$/;
  const namesLeader = texts.some((t) => [...t.matchAll(/\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g)].some((m) => !NOT_PERSON.test(m[1]!) && !NOT_PERSON.test(m[2]!)));
  const leaderOk = !input.needsLeader || Boolean((input.leaderAnswer ?? "").trim()) || said("leader_pick").length > 0 || namesLeader;
  return { catchUpDone, decided: hasReason && leaderOk };
}

/**
 * QA 9:37 AM: the gate names where the material came from (never "caught up on the
 * readings" when Pau Pau never had them): caught up (and from what), declined, or waiting.
 */
export function materialGateLabel(input: { catchUpDone: boolean; materialShown: boolean; kinds: string[]; materialAnswer?: string | null }): string {
  const said = (input.materialAnswer ?? "").toLowerCase();
  const readIt = /\b(i(?:'ve| have)? (?:already )?read|i did read|read (?:it|them|both|all)|finished (?:it|them|the reading))\b/.test(said) && !/\b(haven'?t|have not|didn'?t|did not|not yet|never)\b/.test(said);
  const passed = /\b(no thanks|don'?t need|no need|not now|skip|pass)\b/.test(said);
  // In-chat catch-up (QA 9:37): the summary bubbles show right under their answer, so an
  // answer plus summaries means it was shown even when the server flag is pre-confirm only.
  const shown = input.materialShown || (input.kinds.length > 0 && said.trim().length > 0 && !passed && !readIt);
  if (shown && input.kinds.includes("reading")) return "Material: caught up from your own reading";
  if (readIt) return "Material: caught up (you read it yourself)";
  if (shown && input.kinds.includes("found")) return "Material: caught up from the source I found online";
  if (shown && input.kinds.some((k) => k === "knowledge" || k === "overview" || k === "general" || k === "assignment"))
    return "Material: caught up from general knowledge (not your copy yet)";
  if (passed) return "Material: you passed on the catch-up";
  return "Material: waiting on the readings";
}

/** The Stage 1 gate checklist on north-star papers. */
export function northstarChecklist(input: { confirmed: boolean; catchUpDone: boolean; decided: boolean; stanceOk: boolean; materialLabel?: string }): { label: string; done: boolean }[] {
  return [
    { label: "Assignment confirmed", done: input.confirmed },
    {
      label: input.materialLabel ?? (input.catchUpDone ? "Material: caught up" : "Material: waiting on the readings"),
      done: input.catchUpDone && !/waiting/.test(input.materialLabel ?? ""),
    },
    { label: "Decision made, with your reason", done: input.decided },
    { label: "Early take: a few sentences in your own words", done: input.stanceOk },
  ];
}

/** A friendly nudge while their note is still short, never a bare word counter. */
export function shortNoteNudge(kind: "stance" | "story", words: number): string | null {
  if (words <= 0) return null;
  if (kind === "stance") {
    if (words >= 25) return null;
    return words < 10
      ? "Good start. Add a sentence or two on why you think that, like you'd explain it to a friend."
      : "Almost there. One more sentence, maybe an example, and your early take is ready.";
  }
  if (words >= 15) return null;
  return "A little more on what you'd write about and why, and your own angle is ready.";
}
