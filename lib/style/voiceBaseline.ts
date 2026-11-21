import {
  VOICE_NATURAL_WORDS_ENOUGH,
  VOICE_NATURAL_WORDS_LOW,
  VOICE_NATURAL_WORDS_PLENTY,
  VOICE_PASTED_SHARE_NOTE,
} from "@/lib/config";
import {
  VOICE_NOTE_ANSWERS,
  VOICE_NOTE_ANSWERS_LOW,
  VOICE_NOTE_ANSWERS_SHORT,
  VOICE_NOTE_SAMPLE,
  VOICE_NOTE_SAMPLE_LOW,
  VOICE_NOTE_SAMPLE_SHORT,
} from "@/lib/copy/voiceNotes";
import { wordCount } from "@/lib/utils";

export type VoiceSurface = "answers" | "sample";
export type VoiceTier = "plenty" | "enough" | "thin" | "low";

export type VoiceNoteInput = {
  naturalWords: number;
  pastedShare: number;
  hasBaseline: boolean;
  surface: VoiceSurface;
};

export type VoiceNoteResult = {
  tier: VoiceTier | null;
  note: string | null;
};

const NOTE = {
  answers: {
    paste: VOICE_NOTE_ANSWERS,
    short: VOICE_NOTE_ANSWERS_SHORT,
    low: VOICE_NOTE_ANSWERS_LOW,
  },
  sample: {
    paste: VOICE_NOTE_SAMPLE,
    short: VOICE_NOTE_SAMPLE_SHORT,
    low: VOICE_NOTE_SAMPLE_LOW,
  },
} as const;

/** Typed or spoken words. Pasted words count as 0. Missing meta counts as all natural. */
export function naturalWordsForAnswer(
  words: number,
  pasteRatio: number | null | undefined,
): number {
  if (pasteRatio == null || Number.isNaN(pasteRatio)) return Math.max(0, words);
  const ratio = Math.min(1, Math.max(0, pasteRatio));
  return Math.round(Math.max(0, words) * (1 - ratio));
}

/** Baseline metric weight. Fully pasted answers weigh 0.2. Does not add natural words. */
export function pasteAnswerWeight(pasteRatio: number | null | undefined): number {
  if (pasteRatio == null || Number.isNaN(pasteRatio)) return 1;
  const ratio = Math.min(1, Math.max(0, pasteRatio));
  return 1 - 0.8 * ratio;
}

export function voiceTierFor(naturalWords: number): VoiceTier {
  if (naturalWords >= VOICE_NATURAL_WORDS_PLENTY) return "plenty";
  if (naturalWords >= VOICE_NATURAL_WORDS_ENOUGH) return "enough";
  if (naturalWords >= VOICE_NATURAL_WORDS_LOW) return "thin";
  return "low";
}

/**
 * Hybrid voice note (Colton t51). One note at most.
 * No baseline → no note. Plenty of natural voice → no note at any paste share.
 */
export function voiceNoteFor(input: VoiceNoteInput): VoiceNoteResult {
  if (!input.hasBaseline) return { tier: null, note: null };
  const tier = voiceTierFor(input.naturalWords);
  const copy = NOTE[input.surface];
  if (tier === "plenty") return { tier, note: null };
  if (tier === "enough") {
    if (input.pastedShare > VOICE_PASTED_SHARE_NOTE) {
      return { tier, note: copy.paste };
    }
    return { tier, note: null };
  }
  if (tier === "thin") {
    if (input.pastedShare > VOICE_PASTED_SHARE_NOTE) {
      return { tier, note: copy.paste };
    }
    return { tier, note: copy.short };
  }
  return { tier, note: copy.low };
}

/** Voice notes render on Stage 6 and the checker full report, never while writing. */
export function voiceNoteForStage(
  stage: number,
  input: Omit<VoiceNoteInput, "surface">,
): VoiceNoteResult {
  if (stage !== 6) return { tier: null, note: null };
  return voiceNoteFor({ ...input, surface: "answers" });
}

export type CountedAnswerKind =
  | "stage1_voice"
  | "move"
  | "thesis"
  | "teach_else"
  | "mirror"
  | "probe"
  | "memory"
  | "highlight_followup"
  | "logic_revise"
  | "stage3_note"
  | "stage5_draft"
  | "brought_back_name"
  | "assignment_paste";

const COUNTED = new Set<CountedAnswerKind>([
  "stage1_voice",
  "move",
  "thesis",
  "teach_else",
  "mirror",
  "probe",
  "memory",
  "highlight_followup",
  "logic_revise",
]);

export type CountedAnswer = {
  kind: CountedAnswerKind;
  text: string;
  /** Null means the answer predates paste meta and counts as fully natural. */
  pasteRatio?: number | null;
  pastedChars?: number;
  typedChars?: number;
  spokenChars?: number;
};

export type VoiceTotals = {
  hasBaseline: boolean;
  naturalWords: number;
  pastedShare: number;
  countedWords: number;
};

export function summarizeCountedAnswers(answers: CountedAnswer[]): VoiceTotals {
  let naturalWords = 0;
  let pastedChars = 0;
  let typedChars = 0;
  let countedWords = 0;
  let any = false;

  for (const answer of answers) {
    if (!COUNTED.has(answer.kind)) continue;
    const text = answer.text.trim();
    if (!text) continue;
    any = true;
    const words = wordCount(text);
    countedWords += words;
    const spoken = Math.max(0, answer.spokenChars ?? 0);
    const pasted = Math.max(0, answer.pastedChars ?? 0);
    const typed = Math.max(0, answer.typedChars ?? 0) + spoken;
    if (answer.pastedChars != null || answer.typedChars != null || spoken > 0) {
      pastedChars += pasted;
      typedChars += typed;
      const totalChars = pasted + typed;
      const ratio = totalChars > 0 ? pasted / totalChars : 0;
      naturalWords += naturalWordsForAnswer(words, ratio);
    } else {
      naturalWords += naturalWordsForAnswer(words, answer.pasteRatio);
      const len = text.length;
      const ratio = answer.pasteRatio ?? 0;
      pastedChars += Math.round(len * ratio);
      typedChars += len - Math.round(len * ratio);
    }
  }

  const charTotal = pastedChars + typedChars;
  return {
    hasBaseline: any,
    naturalWords,
    pastedShare: charTotal > 0 ? pastedChars / charTotal : 0,
    countedWords,
  };
}

export type BaselineChoice = {
  source: "sample" | "voice_profile" | "none";
  naturalWords: number | null;
  pastedShare: number | null;
  tier: VoiceTier | null;
  note: string | null;
  hasBaseline: boolean;
};

function quality(result: VoiceNoteResult): number {
  if (!result.tier) return -1;
  const tierScore = { plenty: 400, enough: 300, thin: 200, low: 100 }[result.tier];
  const penalty = result.note == null ? 0 : result.tier === "low" ? 2 : 1;
  return tierScore - penalty;
}

/** Profile wins only when its tier is better. A tie keeps the sample. */
export function chooseVoiceBaseline(input: {
  sample?: { naturalWords: number; pastedShare: number; hasBaseline: boolean } | null;
  profile?: { naturalWords: number; pastedShare: number; hasBaseline: boolean } | null;
}): BaselineChoice {
  const sample = input.sample?.hasBaseline
    ? voiceNoteFor({ ...input.sample, surface: "sample" })
    : null;
  const profile = input.profile?.hasBaseline
    ? voiceNoteFor({
        naturalWords: input.profile.naturalWords,
        pastedShare: input.profile.pastedShare,
        hasBaseline: true,
        surface: "answers",
      })
    : null;

  if (sample && profile && quality(profile) > quality(sample)) {
    return {
      source: "voice_profile",
      naturalWords: input.profile!.naturalWords,
      pastedShare: input.profile!.pastedShare,
      tier: profile.tier,
      note: profile.note,
      hasBaseline: true,
    };
  }
  if (sample && input.sample) {
    return {
      source: "sample",
      naturalWords: input.sample.naturalWords,
      pastedShare: input.sample.pastedShare,
      tier: sample.tier,
      note: sample.note,
      hasBaseline: true,
    };
  }
  if (profile && input.profile) {
    return {
      source: "voice_profile",
      naturalWords: input.profile.naturalWords,
      pastedShare: input.profile.pastedShare,
      tier: profile.tier,
      note: profile.note,
      hasBaseline: true,
    };
  }
  return {
    source: "none",
    naturalWords: null,
    pastedShare: null,
    tier: null,
    note: null,
    hasBaseline: false,
  };
}

export function profilePastedShare(typedWordShare: number | null | undefined): number {
  if (typedWordShare == null || Number.isNaN(typedWordShare)) return 0;
  return 1 - Math.min(1, Math.max(0, typedWordShare));
}

export function clampSampleMeta(
  textLength: number,
  meta: { pastedChars: number; typedChars: number; spokenChars?: number },
): { pastedChars: number; typedChars: number; pastedShare: number } {
  let pasted = Math.max(0, meta.pastedChars);
  let typed = Math.max(0, meta.typedChars) + Math.max(0, meta.spokenChars ?? 0);
  const total = pasted + typed;
  if (textLength >= 0 && total > textLength && total > 0) {
    const scale = textLength / total;
    pasted = Math.round(pasted * scale);
    typed = Math.max(0, textLength - pasted);
  }
  const denom = pasted + typed;
  return {
    pastedChars: pasted,
    typedChars: typed,
    pastedShare: denom > 0 ? pasted / denom : 0,
  };
}
