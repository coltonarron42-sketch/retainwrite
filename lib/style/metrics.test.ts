import { describe, expect, it } from "vitest";
import { computeStyleMetrics, splitSentences } from "./metrics";

describe("computeStyleMetrics", () => {
  it("counts words and sentences", () => {
    const text =
      "I love writing papers at night. It feels calm. Coffee helps me think.";
    const m = computeStyleMetrics(text);
    expect(m.wordCount).toBeGreaterThan(10);
    expect(m.avgSentenceLength).toBeGreaterThan(3);
    expect(["casual", "neutral", "formal"]).toContain(m.formality);
  });

  it("handles abbreviations without oversplitting", () => {
    const sentences = splitSentences("I met Dr. Lee yesterday. Then we talked.");
    expect(sentences.length).toBe(2);
  });
});
