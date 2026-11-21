import {
  MIN_VOICE_SAMPLE_WORDS,
  STAGE1_VOICE_MIN_LONG_ANSWER_WORDS,
  STAGE1_VOICE_MIN_LONG_ANSWERS,
  STAGE1_VOICE_MIN_WORDS,
} from "@/lib/config";
import { wordCount } from "@/lib/utils";

export type VoiceAnswer = {
  text: string;
  isVoiceSample: boolean;
  kind?: string;
  pasteRatio?: number;
};

export type VoiceMinimumInput = {
  answers: VoiceAnswer[];
  /** Keep-baseline exception when a recent voice_profiles row exists */
  keepBaseline?: boolean;
};

export type VoiceMinimumResult = {
  ok: boolean;
  totalWords: number;
  longAnswerCount: number;
  personalWords: number;
  needsFallback: boolean;
  reasons: string[];
};

export function collectVoiceSampleText(answers: VoiceAnswer[]): string {
  return answers
    .filter((a) => a.isVoiceSample)
    .map((a) => a.text.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Weighted sample for baseline metrics: typed answers count more than pasted.
 * Invisible to the student; never blocks.
 */
export function collectWeightedVoiceSample(answers: VoiceAnswer[]): string {
  const parts: string[] = [];
  for (const a of answers.filter((x) => x.isVoiceSample && x.text.trim())) {
    const ratio = a.pasteRatio ?? 0;
    if (ratio > 0.6) {
      // keep once (pasted-heavy)
      parts.push(a.text.trim());
    } else {
      // typed-heavy: include twice so metrics lean on natural typing
      parts.push(a.text.trim(), a.text.trim());
    }
  }
  return parts.join("\n");
}

export function evaluateStage1VoiceMinimum(
  input: VoiceMinimumInput,
): VoiceMinimumResult {
  const voiceAnswers = input.answers.filter((a) => a.isVoiceSample);
  const counts = voiceAnswers.map((a) => wordCount(a.text));
  const totalWords = counts.reduce((s, n) => s + n, 0);
  const longAnswerCount = counts.filter(
    (n) => n >= STAGE1_VOICE_MIN_LONG_ANSWER_WORDS,
  ).length;

  const personal = voiceAnswers.find((a) => a.kind === "personal");
  const personalWords = personal ? wordCount(personal.text) : 0;

  const reasons: string[] = [];

  if (input.keepBaseline) {
    // Spec 8.3 keep exception: ≥150 total, at least one ≥40 (personal no longer required)
    const ok =
      totalWords >= MIN_VOICE_SAMPLE_WORDS && longAnswerCount >= 1;
    if (totalWords < MIN_VOICE_SAMPLE_WORDS) {
      reasons.push(`Need at least ${MIN_VOICE_SAMPLE_WORDS} words with kept baseline`);
    }
    if (longAnswerCount < 1) {
      reasons.push("Need at least one answer of 40+ words");
    }
    return {
      ok,
      totalWords,
      longAnswerCount,
      personalWords,
      needsFallback: !ok,
      reasons,
    };
  }

  if (totalWords < STAGE1_VOICE_MIN_WORDS) {
    reasons.push(
      `Need at least ${STAGE1_VOICE_MIN_WORDS} words across voice answers (have ${totalWords})`,
    );
  }
  if (longAnswerCount < STAGE1_VOICE_MIN_LONG_ANSWERS) {
    reasons.push(
      `Need at least ${STAGE1_VOICE_MIN_LONG_ANSWERS} answers of ${STAGE1_VOICE_MIN_LONG_ANSWER_WORDS}+ words`,
    );
  }
  // Personal ≥40 dropped (Nov 20, 2026) — question is skippable

  const ok = reasons.length === 0;
  return {
    ok,
    totalWords,
    longAnswerCount,
    personalWords,
    needsFallback: !ok,
    reasons,
  };
}
