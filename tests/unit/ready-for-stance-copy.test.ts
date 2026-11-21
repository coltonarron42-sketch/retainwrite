import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ready for stance copy", () => {
  it("does not show a grade level or sentence-length score", () => {
    const source = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(source).toContain("We have enough of your voice to coach you.");
    expect(source).not.toContain("grade-level");
    expect(source).not.toContain("words per sentence");
  });
});
