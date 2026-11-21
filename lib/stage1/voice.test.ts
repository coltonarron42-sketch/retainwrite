import { describe, expect, it } from "vitest";
import { evaluateStage1VoiceMinimum } from "@/lib/stage1/voice";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("stage1 voice minimum", () => {
  it("requires 200 words and 2×40 (personal no longer required)", () => {
    const short = evaluateStage1VoiceMinimum({
      answers: [
        { text: words(100), isVoiceSample: true, kind: "interest" },
        { text: words(50), isVoiceSample: true, kind: "coaching" },
      ],
    });
    expect(short.ok).toBe(false);
    expect(short.needsFallback).toBe(true);

    const ok = evaluateStage1VoiceMinimum({
      answers: [
        { text: words(120), isVoiceSample: true, kind: "interest" },
        { text: words(50), isVoiceSample: true, kind: "coaching" },
        { text: words(40), isVoiceSample: true, kind: "personal" },
      ],
    });
    expect(ok.totalWords).toBe(210);
    expect(ok.ok).toBe(true);
  });

  it("applies keep-baseline exception without personal requirement", () => {
    const result = evaluateStage1VoiceMinimum({
      keepBaseline: true,
      answers: [
        { text: words(110), isVoiceSample: true, kind: "coaching" },
        { text: words(40), isVoiceSample: true, kind: "interest" },
      ],
    });
    expect(result.totalWords).toBe(150);
    expect(result.ok).toBe(true);
  });
});
