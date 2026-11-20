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
    // Spec 8.3 keep exception: ≥150 total, personal ≥40, at least one ≥40
    const ok =
      totalWords >= MIN_VOICE_SAMPLE_WORDS &&
      personalWords >= STAGE1_VOICE_MIN_LONG_ANSWER_WORDS &&
      longAnswerCount >= 1;
    if (totalWords < MIN_VOICE_SAMPLE_WORDS) {
      reasons.push(`Need at least ${MIN_VOICE_SAMPLE_WORDS} words with kept baseline`);
    }
    if (personalWords < STAGE1_VOICE_MIN_LONG_ANSWER_WORDS) {
      reasons.push("Personal answer needs at least 40 words");
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
  if (personalWords < STAGE1_VOICE_MIN_LONG_ANSWER_WORDS) {
    reasons.push("Personal question needs at least 40 words");
  }

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
