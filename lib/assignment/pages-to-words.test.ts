import { describe, expect, it } from "vitest";
import {
  applyPageWordEstimates,
  lengthMidpointWords,
} from "@/lib/assignment/pages-to-words";

describe("page-to-word estimate", () => {
  it("uses 275 words per page for ranges", () => {
    const result = applyPageWordEstimates({ pagesMin: 5, pagesMax: 7 });
    expect(result.wordsEstimateMin).toBe(1375);
    expect(result.wordsEstimateMax).toBe(1925);
  });

  it("never overwrites an explicit word count", () => {
    const result = applyPageWordEstimates({
      pagesMin: 5,
      pagesMax: 7,
      wordsMin: 1500,
      wordsMax: 1800,
      wordsEstimateMin: 9999,
    });
    expect(result.wordsMin).toBe(1500);
    expect(result.wordsEstimateMin).toBeUndefined();
  });

  it("midpoint prefers explicit words", () => {
    expect(
      lengthMidpointWords({
        wordsMin: 1000,
        wordsMax: 2000,
        wordsEstimateMin: 1375,
        wordsEstimateMax: 1925,
      }),
    ).toBe(1500);
  });
});
