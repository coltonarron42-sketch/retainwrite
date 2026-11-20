import { describe, expect, it } from "vitest";
import { evaluateStage1VoiceMinimum } from "@/lib/stage1/voice";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("stage1 voice minimum", () => {
  it("requires 250 / 2×40 / personal 40", () => {
    const result = evaluateStage1VoiceMinimum({
      answers: [
        { text: words(100), isVoiceSample: true, kind: "interest" },
        { text: words(50), isVoiceSample: true, kind: "coaching" },
        { text: words(50), isVoiceSample: true, kind: "personal" },
        { text: words(40), isVoiceSample: true, kind: "coaching" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.needsFallback).toBe(true);

    const ok = evaluateStage1VoiceMinimum({
      answers: [
        { text: words(120), isVoiceSample: true, kind: "interest" },
        { text: words(50), isVoiceSample: true, kind: "coaching" },
        { text: words(50), isVoiceSample: true, kind: "personal" },
        { text: words(40), isVoiceSample: true, kind: "coaching" },
      ],
    });
    expect(ok.totalWords).toBe(260);
    expect(ok.ok).toBe(true);
  });

  it("applies keep-baseline exception", () => {
    const result = evaluateStage1VoiceMinimum({
      keepBaseline: true,
      answers: [
        { text: words(80), isVoiceSample: true, kind: "coaching" },
        { text: words(40), isVoiceSample: true, kind: "personal" },
        { text: words(40), isVoiceSample: true, kind: "interest" },
      ],
    });
    expect(result.totalWords).toBe(160);
    expect(result.ok).toBe(true);
  });
});
