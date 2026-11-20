import { describe, expect, it } from "vitest";
import { estimateImageQualityScore } from "@/lib/assignment/ocr";

describe("estimateImageQualityScore", () => {
  it("scores low-res dark images below the retake threshold", () => {
    const score = estimateImageQualityScore({
      width: 200,
      height: 200,
      meanLuminance: 25,
    });
    expect(score).toBeLessThan(0.45);
  });

  it("scores a clear phone-sized image above threshold", () => {
    const score = estimateImageQualityScore({
      width: 1200,
      height: 1600,
      meanLuminance: 128,
    });
    expect(score).toBeGreaterThanOrEqual(0.45);
  });

  it("penalizes very dark frames", () => {
    const score = estimateImageQualityScore({
      width: 1200,
      height: 1600,
      meanLuminance: 20,
    });
    expect(score).toBeLessThan(0.7);
  });
});
