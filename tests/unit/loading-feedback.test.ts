import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("loading feedback", () => {
  it("shows a live wait state for parse, stance, and the next stage", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(intake).toContain("Reading the assignment…");
    expect(intake).toContain("Still reading");
    expect(intake).toContain("Starting the stance interview…");
    expect(loop).toContain("Opening the next stage…");
  });
});
