export const SITE_URL = "https://retainwrite.com";
/** Stage specs override the build prompt hello@ address. */
export const EMAIL_FROM = "RetainWrite Coach <coach@send.retainwrite.com>";
export const PRICES = { single: 900, pack3: 1500, audio: 199 } as const; // cents, USD
export const PACK3_CREDITS = 3;
export const MIN_VOICE_SAMPLE_WORDS = 150; // AI checker voice check only
export const STAGE1_VOICE_MIN_WORDS = 250; // Stage 1 embedded voice sample
export const STAGE1_VOICE_MIN_LONG_ANSWERS = 2;
export const STAGE1_VOICE_MIN_LONG_ANSWER_WORDS = 40;
export const WORDS_PER_PAGE_DOUBLE_SPACED = 275;
export const MODEL_FAST = "grok-4.3"; // live probing / classification / Stage 1 questions
export const MODEL_STRONG = "grok-4.7"; // assignment parsing, rubric, section feedback, extraction
export const TTS_VOICE_DEFAULT = "en-US-Chirp3-HD-Charon";
export const VOICE_BASELINE_MAX_AGE_DAYS = 180;

export const MISMATCH_THRESHOLDS = {
  sentenceLengthTell: 0.6,
  sentenceLengthStrong: 1.0,
  sentenceLengthAbsGap: 6,
  readingGradeTell: 4.0,
  readingGradeStrong: 6.0,
  formalityTell: 0.35,
  formalityStrong: 0.5,
  unseenVocabTell: 0.12,
  unseenVocabStrong: 0.2,
  minWords: 120,
  shortSampleWords: 200,
} as const;

export const STAGE_LABELS = [
  "Intake",
  "Stance",
  "Outline",
  "Sources",
  "Draft",
  "Revise",
] as const;

export const CHECKOUT_PRODUCTS = {
  single: {
    name: "RetainWrite — 1 paper",
    amount: PRICES.single,
  },
  pack3: {
    name: "RetainWrite — 3-paper pack (audio included)",
    amount: PRICES.pack3,
  },
  audio: {
    name: "Audio study beats — 1 paper",
    amount: PRICES.audio,
  },
} as const;

export type PurchaseKind = keyof typeof CHECKOUT_PRODUCTS | "feedback_credit";
