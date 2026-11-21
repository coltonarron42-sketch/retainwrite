// SOP: coaching only, never generate submission text

import {
  chooseVoiceBaseline,
  clampSampleMeta,
  naturalWordsForAnswer,
  profilePastedShare,
  type BaselineChoice,
} from "@/lib/style/voiceBaseline";
import { wordCount } from "@/lib/utils";

export type SampleMeta = {
  pastedChars: number;
  typedChars: number;
  spokenChars?: number;
};

export function sampleBaseline(text: string, meta: SampleMeta | null): {
  hasBaseline: boolean;
  naturalWords: number;
  pastedShare: number;
} {
  const trimmed = text.trim();
  if (!trimmed) return { hasBaseline: false, naturalWords: 0, pastedShare: 0 };
  if (!meta) {
    return {
      hasBaseline: true,
      naturalWords: wordCount(trimmed),
      pastedShare: 0,
    };
  }
  const clamped = clampSampleMeta(trimmed.length, meta);
  return {
    hasBaseline: true,
    naturalWords: naturalWordsForAnswer(wordCount(trimmed), clamped.pastedShare),
    pastedShare: clamped.pastedShare,
  };
}

export function profileBaseline(profile: {
  naturalWords?: number | null;
  wordCount?: number | null;
  typedWordShare?: number | null;
} | null): { hasBaseline: boolean; naturalWords: number; pastedShare: number } {
  if (!profile) return { hasBaseline: false, naturalWords: 0, pastedShare: 0 };
  const pastedShare = profilePastedShare(profile.typedWordShare);
  const natural =
    profile.naturalWords ??
    (profile.wordCount != null && profile.typedWordShare != null
      ? Math.round(profile.wordCount * profile.typedWordShare)
      : profile.wordCount != null
        ? profile.wordCount
        : null);
  if (natural == null) return { hasBaseline: false, naturalWords: 0, pastedShare: 0 };
  return { hasBaseline: true, naturalWords: natural, pastedShare };
}

export type CheckerVoiceReport = BaselineChoice & {
  /** Preview never includes the note. */
  note: string | null;
};

export function checkerVoiceReport(input: {
  sampleText?: string;
  sampleMeta?: SampleMeta | null;
  profile?: {
    naturalWords?: number | null;
    wordCount?: number | null;
    typedWordShare?: number | null;
  } | null;
  preview?: boolean;
}): CheckerVoiceReport {
  const chosen = chooseVoiceBaseline({
    sample: input.sampleText?.trim()
      ? sampleBaseline(input.sampleText, input.sampleMeta ?? null)
      : null,
    profile: profileBaseline(input.profile ?? null),
  });
  if (input.preview) return { ...chosen, note: null };
  return chosen;
}
