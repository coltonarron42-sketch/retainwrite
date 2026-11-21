import { describe, expect, it } from "vitest";
import {
  assertStoryAngleQuestion,
  buildStoryAngleFallback,
} from "@/lib/stage1/story-angles";

describe("story angles", () => {
  it("builds 3–4 question angles ending in ?", () => {
    const angles = buildStoryAngleFallback({
      topic: "margin for owners",
      studentPhrases: ["raised prices at the shop last spring"],
    });
    expect(angles.length).toBeGreaterThanOrEqual(3);
    expect(angles.length).toBeLessThanOrEqual(4);
    for (const a of angles) {
      expect(assertStoryAngleQuestion(a.question)).toBe(true);
    }
  });
});
