import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ready for stance copy", () => {
  it("does not show a grade level or sentence-length score", () => {
    const source = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    const voice = readFileSync("lib/stage1/voice.ts", "utf8");
    // PC-32: no voice readiness line at all.
    expect(voice).not.toContain("enough of your voice");
    expect(source).not.toContain("readyVoiceLine");
    expect(source).toContain("Starting the stance interview…");
    expect(source).toContain("Somewhat comfortable");
    expect(source).not.toContain("grade-level");
    expect(source).not.toContain("words per sentence");
    expect(source).not.toContain("words that sound like you");
  });
});
