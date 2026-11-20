import { describe, expect, it } from "vitest";
import { assertStageUnlocked, initialStageProgress } from "./assert";

describe("assertStageUnlocked", () => {
  it("allows stage 1 always", () => {
    expect(assertStageUnlocked(initialStageProgress(), 1).ok).toBe(true);
  });

  it("locks stage 2 until stage 1 complete", () => {
    const progress = initialStageProgress();
    expect(assertStageUnlocked(progress, 2).ok).toBe(false);
    progress[0].status = "complete";
    expect(assertStageUnlocked(progress, 2).ok).toBe(true);
  });
});
