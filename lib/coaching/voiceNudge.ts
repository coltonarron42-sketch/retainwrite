// SOP: coaching only, never generate submission text

import type { MismatchResult, MismatchTell } from "@/lib/style/mismatch";

export const VOICE_NUDGE_HEADLINE =
  "This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?";

export const VOICE_NUDGE_MAKE = "Make it sound like me";
export const VOICE_NUDGE_KEEP = "Keep it as is";
export const VOICE_NUDGE_NOTICED = "What we noticed";

export const VOICE_NUDGE_EVENTS = {
  shown: "voice_nudge_shown",
  reworkOpened: "voice_nudge_rework_opened",
  kept: "voice_nudge_kept",
} as const;

const TIPS = [
  "Try splitting the longest sentence.",
  "Swap a word you wouldn't say out loud for one you would.",
  "Read this part aloud and mark anything you wouldn't say.",
] as const;

export function describeTell(tell: MismatchTell, examples: string[] = []): string {
  if (tell.signal === "sentence_length") {
    return `sentences here average ${Math.round(tell.draftValue)} words; yours usually run about ${Math.round(tell.sampleValue)}`;
  }
  if (tell.signal === "reading_grade") {
    const gap = Math.max(1, Math.round(tell.draftValue - tell.sampleValue));
    return `a reading level about ${gap} grades above your usual`;
  }
  if (tell.signal === "formality") {
    return "the tone here is more formal than your usual voice";
  }
  const list = examples.slice(0, 8).join(", ");
  return list
    ? `words you don't usually use: ${list}`
    : "words you don't usually use showed up here";
}

export function voiceNudgeTips(result: MismatchResult): string[] {
  return TIPS.filter((tip) => {
    if (tip.startsWith("Try splitting")) {
      return result.tells.some((tell) => tell.signal === "sentence_length");
    }
    if (tip.startsWith("Swap")) {
      return result.tells.some((tell) => tell.signal === "unseen_vocab");
    }
    return true;
  }).slice(0, 3);
}

export function checklistItem5Resolved(input: {
  triggered: boolean;
  kept: boolean;
  revisionSavedAfterRework: boolean;
}): boolean {
  if (!input.triggered) return true;
  return input.kept || input.revisionSavedAfterRework;
}

export function nudgeEventDetail(result: MismatchResult, section: string) {
  return {
    level: result.tells.some((tell) => tell.level === "strong") ? "strong" : "tell",
    tells: result.tells.map((tell) => tell.signal),
    section,
  };
}
