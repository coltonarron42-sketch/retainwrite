import {
  MISMATCH_THRESHOLDS,
  VOICE_SHORT_SAMPLE_NATURAL_WORDS,
} from "@/lib/config";
import { contentWords, type StyleMetrics } from "./metrics";

export type MismatchTell = {
  signal: "sentence_length" | "reading_grade" | "formality" | "unseen_vocab";
  sampleValue: number;
  draftValue: number;
  level: "tell" | "strong";
};

export type MismatchResult = {
  triggered: boolean;
  tells: MismatchTell[];
  examples: string[];
};

function stem(word: string): string {
  return word.replace(/(?:es|ed|ing|ly|s)$/i, "");
}

export function evaluateMismatch(
  draft: StyleMetrics,
  sample: StyleMetrics,
  allowList: string[] = [],
  draftText = "",
  options?: { naturalWords?: number },
): MismatchResult {
  const t = MISMATCH_THRESHOLDS;
  if (draft.wordCount < t.minWords) {
    return { triggered: false, tells: [], examples: [] };
  }

  const tells: MismatchTell[] = [];
  const sentenceRatio =
    draft.avgSentenceLength / Math.max(1, sample.avgSentenceLength) - 1;
  const sentenceAbs = draft.avgSentenceLength - sample.avgSentenceLength;
  if (sentenceRatio >= t.sentenceLengthTell && sentenceAbs >= t.sentenceLengthAbsGap) {
    const strong =
      sentenceRatio >= t.sentenceLengthStrong &&
      sample.wordCount >= t.shortSampleWords;
    tells.push({
      signal: "sentence_length",
      sampleValue: sample.avgSentenceLength,
      draftValue: draft.avgSentenceLength,
      level: strong ? "strong" : "tell",
    });
  }

  const gradeGap = draft.readingGrade - sample.readingGrade;
  if (gradeGap >= t.readingGradeTell) {
    tells.push({
      signal: "reading_grade",
      sampleValue: sample.readingGrade,
      draftValue: draft.readingGrade,
      level: gradeGap >= t.readingGradeStrong ? "strong" : "tell",
    });
  }

  const formalityGap = draft.formalityScore - sample.formalityScore;
  if (formalityGap >= t.formalityTell) {
    tells.push({
      signal: "formality",
      sampleValue: sample.formalityScore,
      draftValue: draft.formalityScore,
      level: formalityGap >= t.formalityStrong ? "strong" : "tell",
    });
  }

  const allow = new Set(
    [...sample.vocabulary, ...allowList].map((w) => stem(w.toLowerCase())),
  );
  const draftContent = [...new Set(contentWords(draftText || draft.vocabulary.join(" ")))];
  const unseen = draftContent.filter(
    (w) => w.length >= 8 && !allow.has(stem(w)),
  );
  const unseenShare =
    unseen.length / Math.max(1, draftContent.length);
  const examples = unseen.slice(0, 8);
  if (unseenShare > t.unseenVocabTell) {
    tells.push({
      signal: "unseen_vocab",
      sampleValue: 0,
      draftValue: Number((unseenShare * 100).toFixed(1)),
      level: unseenShare > t.unseenVocabStrong ? "strong" : "tell",
    });
  }

  const naturalWords = options?.naturalWords;
  const shortSample =
    naturalWords != null && naturalWords < VOICE_SHORT_SAMPLE_NATURAL_WORDS;
  const leveled = shortSample
    ? tells.map((tell) =>
        tell.level === "strong" ? { ...tell, level: "tell" as const } : tell,
      )
    : tells;

  const strongCount = leveled.filter((x) => x.level === "strong").length;
  const tellCount = leveled.length;
  const triggered = strongCount >= 1 || tellCount >= 2;

  return { triggered, tells: leveled, examples };
}
