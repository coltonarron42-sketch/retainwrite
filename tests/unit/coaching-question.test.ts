import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stage 1 coaching question", () => {
  it("does not pretend the topic title is asking the question", () => {
    const source = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(source).not.toContain("asking you to figure out");
    expect(source).not.toContain("what is ${topic} asking");
    expect(source).toContain("what do you think this assignment wants you to figure out");
  });
});
