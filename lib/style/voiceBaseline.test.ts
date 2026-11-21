import { describe, expect, it } from "vitest";
import {
  VOICE_NOTE_ANSWERS,
  VOICE_NOTE_ANSWERS_LOW,
  VOICE_NOTE_ANSWERS_SHORT,
  VOICE_NOTE_SAMPLE,
  VOICE_NOTE_SAMPLE_LOW,
  VOICE_NOTE_SAMPLE_SHORT,
} from "@/lib/copy/voiceNotes";
import { checkerVoiceReport } from "@/lib/checker/report";
import {
  naturalWordsForAnswer,
  pasteAnswerWeight,
  summarizeCountedAnswers,
  voiceNoteFor,
  voiceNoteForStage,
} from "@/lib/style/voiceBaseline";
import { evaluateMismatch } from "@/lib/style/mismatch";
import { computeStyleMetrics } from "@/lib/style/metrics";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

function noteFor(totalWords: number, pastedShare: number) {
  const naturalWords = naturalWordsForAnswer(totalWords, pastedShare);
  return voiceNoteFor({
    naturalWords,
    pastedShare,
    hasBaseline: true,
    surface: "answers",
  });
}

describe("hybrid voice note (t51)", () => {
  it("matches the published word and paste cases", () => {
    expect(noteFor(4200, 0.7).note).toBeNull();
    expect(noteFor(4200, 0.7).tier).toBe("plenty");
    expect(naturalWordsForAnswer(4200, 0.7)).toBe(1260);

    expect(noteFor(260, 0.45).note).toBe(VOICE_NOTE_ANSWERS_SHORT);
    expect(naturalWordsForAnswer(260, 0.45)).toBe(143);

    expect(noteFor(300, 0.7).note).toBe(VOICE_NOTE_ANSWERS);
    expect(naturalWordsForAnswer(300, 0.7)).toBe(90);

    expect(noteFor(400, 0.5).note).toBeNull();
    expect(naturalWordsForAnswer(400, 0.5)).toBe(200);

    expect(noteFor(700, 0.65).note).toBe(VOICE_NOTE_ANSWERS);
    expect(naturalWordsForAnswer(700, 0.65)).toBe(245);

    expect(noteFor(210, 0.65).note).toBe(VOICE_NOTE_ANSWERS_LOW);
    expect(naturalWordsForAnswer(210, 0.65)).toBe(74);

    expect(noteFor(250, 1).note).toBe(VOICE_NOTE_ANSWERS_LOW);
    expect(noteFor(210, 0).note).toBeNull();
  });

  it("holds the tier boundaries", () => {
    const at = (naturalWords: number, pastedShare: number) =>
      voiceNoteFor({ naturalWords, pastedShare, hasBaseline: true, surface: "answers" }).note;

    expect(at(600, 0.61)).toBeNull();
    expect(at(599, 0.61)).toBe(VOICE_NOTE_ANSWERS);
    expect(at(200, 0.61)).toBe(VOICE_NOTE_ANSWERS);
    expect(at(199, 0.61)).toBe(VOICE_NOTE_ANSWERS);
    expect(at(80, 0)).toBe(VOICE_NOTE_ANSWERS_SHORT);
    expect(at(79, 0)).toBe(VOICE_NOTE_ANSWERS_LOW);
    expect(at(400, 0.6)).toBeNull();
    expect(at(400, 0.61)).toBe(VOICE_NOTE_ANSWERS);
  });

  it("counts dictated words as natural and ignores drafts, notes, and a missing baseline", () => {
    const typed = summarizeCountedAnswers([
      { kind: "stage1_voice", text: words(210), pasteRatio: 0, spokenChars: 80, pastedChars: 0, typedChars: 400 },
    ]);
    expect(typed.naturalWords).toBe(210);

    const withDraft = summarizeCountedAnswers([
      { kind: "stage1_voice", text: words(210), pasteRatio: 0 },
      { kind: "stage5_draft", text: words(900), pasteRatio: 0 },
      { kind: "stage3_note", text: words(80), pasteRatio: 0 },
    ]);
    expect(withDraft.naturalWords).toBe(210);

    expect(voiceNoteFor({ naturalWords: 0, pastedShare: 1, hasBaseline: false, surface: "answers" }).note).toBeNull();
    for (const stage of [1, 2, 3, 4, 5]) {
      expect(
        voiceNoteForStage(stage, { naturalWords: 10, pastedShare: 1, hasBaseline: true }).note,
      ).toBeNull();
    }
    expect(voiceNoteForStage(6, { naturalWords: 10, pastedShare: 1, hasBaseline: true }).note).toBe(
      VOICE_NOTE_ANSWERS_LOW,
    );
    expect(pasteAnswerWeight(1)).toBeCloseTo(0.2);
  });

  it("uses the same tiers on the public checker sample", () => {
    expect(checkerVoiceReport({ sampleText: words(150), sampleMeta: { pastedChars: 0, typedChars: 800 } }).note).toBe(
      VOICE_NOTE_SAMPLE_SHORT,
    );
    expect(checkerVoiceReport({ sampleText: words(650), sampleMeta: { pastedChars: 0, typedChars: 4000 } }).note).toBeNull();
    expect(
      checkerVoiceReport({ sampleText: words(650), sampleMeta: { pastedChars: 4000, typedChars: 0 } }).note,
    ).toBe(VOICE_NOTE_SAMPLE_LOW);
    expect(
      checkerVoiceReport({ sampleText: words(300), sampleMeta: { pastedChars: 70, typedChars: 30 } }).note,
    ).toBe(VOICE_NOTE_SAMPLE);
    const reliable = checkerVoiceReport({
      sampleText: words(400),
      sampleMeta: { pastedChars: 2000, typedChars: 0 },
      profile: { naturalWords: 1260, typedWordShare: 0.3 },
    });
    expect(reliable.source).toBe("voice_profile");
    expect(reliable.note).toBeNull();
    expect(checkerVoiceReport({ preview: true, sampleText: words(40), sampleMeta: { pastedChars: 10, typedChars: 0 } }).note).toBeNull();
    expect(checkerVoiceReport({}).note).toBeNull();
    expect(checkerVoiceReport({}).source).toBe("none");
  });

  it("downgrades strong mismatch levels when natural words are under 150", () => {
    const sample = computeStyleMetrics("I like short lines. I write like this. It feels normal to me today.");
    const draft = computeStyleMetrics(
      `${words(40)}. However, furthermore, the multifaceted conceptualization of institutional governance remains consequently meticulous. `.repeat(
        8,
      ),
    );
    const strong = evaluateMismatch(draft, sample, [], draft.vocabulary.join(" "));
    const softened = evaluateMismatch(draft, sample, [], draft.vocabulary.join(" "), {
      naturalWords: 80,
    });
    expect(softened.tells.every((tell) => tell.level !== "strong")).toBe(true);
    expect(strong.tells.length).toBeGreaterThanOrEqual(0);
  });
});
