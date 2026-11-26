/**
 * Background voice capture (Colton t219u, Nov 25, 2026; PC-32).
 *
 * Voice, tone and language are learned quietly from everything the student
 * writes or says, in every stage. Nothing here is a step, a gate or a
 * progress item: there is no "writing sample" to complete. This module only
 * gathers the student's own words; lib/server/voice/capture.ts stores them in
 * the existing voice_profiles / style_profiles rows (no migration).
 */
import { summarizeCountedAnswers, type CountedAnswer } from "@/lib/style/voiceBaseline";
import { wordCount } from "@/lib/utils";

/** A saved Stage 1 answer (intake_answers row). */
export type IntakeVoiceRow = {
  questionId: string;
  kind?: string | null;
  text: string | null | undefined;
  skipped?: boolean;
  pasteRatio?: number | null;
};

/** The parts of the saved Stage 2/3 loop session that hold the student's own words. */
export type LoopVoiceSession = {
  answers?: { kind?: string; text?: string; pasteRatio?: number | null; pastedChars?: number; typedChars?: number; spokenChars?: number }[];
  transcript?: { who?: string; text?: string }[];
  outlineTranscript?: { who?: string; text?: string }[];
} | null;

export type VoicePiece = { stage: 1 | 2 | 3; text: string; pasteRatio: number | null };

/** Never the student's own words: pasted assignment text and names brought back by the app. */
const NOT_THEIR_WORDS = new Set(["assignment_paste", "brought_back_name"]);
/** A bare "skip", "idk", "yes" or a tapped chip says nothing about how they write. */
const MIN_WORDS = 3;
const SKIPPY = /^\s*(skip|pass|next|idk|i don'?t know|not sure|no|nope|yes|yeah|yep|ok(ay)?|sure|looks good)\s*[.!]*\s*$/i;

function usable(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t || SKIPPY.test(t) || wordCount(t) < MIN_WORDS) return null;
  return t;
}

/**
 * Every student-authored answer, oldest first, deduped (one copy of each
 * Stage 1 question: the latest save wins; repeated chat lines count once).
 */
export function collectVoicePieces(input: { intake?: IntakeVoiceRow[]; session?: LoopVoiceSession }): VoicePiece[] {
  const pieces: VoicePiece[] = [];
  const seen = new Set<string>();
  const push = (stage: 1 | 2 | 3, raw: string | null | undefined, pasteRatio: number | null = null) => {
    const text = usable(raw);
    if (!text) return;
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return;
    seen.add(key);
    pieces.push({ stage, text, pasteRatio });
  };
  const latest = new Map<string, IntakeVoiceRow>();
  for (const row of input.intake ?? []) {
    if (row.skipped || row.kind === "story_angle") continue;
    latest.set(row.questionId, row);
  }
  for (const row of latest.values()) push(1, row.text, row.pasteRatio ?? null);
  const s = input.session;
  for (const a of s?.answers ?? []) {
    if (!a || NOT_THEIR_WORDS.has(a.kind ?? "")) continue;
    push(a.kind === "stage3_note" ? 3 : 2, a.text, a.pasteRatio ?? null);
  }
  for (const l of s?.transcript ?? []) if (l?.who === "you") push(2, l.text);
  for (const l of s?.outlineTranscript ?? []) if (l?.who === "you") push(3, l.text);
  return pieces;
}

/** Cap the stored corpus to the most recent words so the row stays small. */
export const VOICE_CORPUS_MAX_WORDS = 4000;

export type VoiceCorpus = {
  text: string;
  words: number;
  naturalWords: number;
  typedWordShare: number;
  stages: number[];
};

/** The text the voice/style profile is computed from, plus its natural-word totals. */
export function buildVoiceCorpus(pieces: VoicePiece[], maxWords = VOICE_CORPUS_MAX_WORDS): VoiceCorpus {
  const kept: VoicePiece[] = [];
  let words = 0;
  for (let i = pieces.length - 1; i >= 0; i--) {
    const w = wordCount(pieces[i]!.text);
    if (words + w > maxWords && kept.length) break;
    kept.unshift(pieces[i]!);
    words += w;
  }
  const counted: CountedAnswer[] = kept.map((p) => ({ kind: "stage1_voice", text: p.text, pasteRatio: p.pasteRatio }));
  const totals = summarizeCountedAnswers(counted);
  return {
    text: kept.map((p) => p.text).join("\n"),
    words,
    naturalWords: totals.naturalWords,
    typedWordShare: Math.round((1 - totals.pastedShare) * 1000) / 1000,
    stages: [...new Set(kept.map((p) => p.stage))].sort(),
  };
}

/**
 * One short line of how they actually talk, for Pau's context block: the
 * longest recent answer in their own words (never a required sample).
 */
export function voiceLineFrom(pieces: VoicePiece[]): string | null {
  const recent = pieces.slice(-12);
  let best: VoicePiece | null = null;
  for (const p of recent) if (!best || wordCount(p.text) > wordCount(best.text)) best = p;
  return best && wordCount(best.text) >= 8 ? best.text : null;
}
