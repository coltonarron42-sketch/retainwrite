export const SITE_URL = "https://www.retainwrite.com";
/** Stage specs override the build prompt hello@ address. */
export const EMAIL_FROM = "RetainWrite Coach <coach@send.retainwrite.com>";
export const PRICES = { single: 900, pack3: 1500, audio: 199 } as const; // cents, USD
export const PACK3_CREDITS = 3;
export const MIN_VOICE_SAMPLE_WORDS = 150; // AI checker voice check only
// PC-32 (Colton t219u, Nov 25, 2026): the Stage 1 voice minimum (200 words, 2 × 40) is retired;
// voice is captured in the background from every answer in every stage.
export const WORDS_PER_PAGE_DOUBLE_SPACED = 275;
export const ASSIGNMENT_MAX_FILES = 15;
export const ASSIGNMENT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const ASSIGNMENT_MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const MODEL_FAST = "grok-4.3"; // live probing / classification / Stage 1 questions
export const MODEL_STRONG = "grok-4.7"; // assignment parsing, rubric, section feedback, extraction
export const TTS_VOICE_DEFAULT = "en-US-Chirp3-HD-Charon";
export const VOICE_BASELINE_MAX_AGE_DAYS = 180;

/** AI-suggested research leads per paper, wildcards included (t47). */
export const RESEARCH_LEADS_MAX_PER_PAPER = 20;
export const SEARCH_PROMPT_MAX_WORDS = 32;

/**
 * Hybrid voice-note tiers (Colton t51). Numbers are provisional.
 * Pasted words do not count toward natural words.
 */
export const VOICE_NATURAL_WORDS_PLENTY = 600;
export const VOICE_NATURAL_WORDS_ENOUGH = 200;
export const VOICE_NATURAL_WORDS_LOW = 80;
/** Used only inside the `enough` tier. */
export const VOICE_PASTED_SHARE_NOTE = 0.6;
/** Below this many natural words, mismatch has no strong levels. */
export const VOICE_SHORT_SAMPLE_NATURAL_WORDS = 150;

/** Allowlisted MIME types for Stage 1 assignment uploads (see lib/assignment/file-types.ts). */
export const ASSIGNMENT_ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/rtf",
  "application/vnd.apple.pages",
  "application/x-iwork-pages-sffpages",
  "text/html",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
] as const;

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

/**
 * Drafting feature flags. Code constants, not env vars.
 * On for production so QA can walk Drafting. Set a switch to false to fall back.
 */
export const FEATURES = {
  draftingMuscle: true,
  interactionLayer: true,
  hiddenDraft: true,
} as const;

/** Full-paper answer key. `structure` is only an outage fallback. */
export const HIDDEN_DRAFT_MODE = "prose" as const;

/** Per-sentence peeks stay off. Zoom-outs happen after a section, not after a sentence. */
export const SKELETON_PEEKS = false;

export const STAGE_LABELS = [
  "Intake",
  "Stance",
  "Outline",
  "Sources",
  "Drafting",
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
