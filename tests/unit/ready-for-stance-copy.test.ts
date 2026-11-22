import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ready for stance copy", () => {
  it("does not show a grade level or sentence-length score", () => {
    const source = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    const voice = readFileSync("lib/stage1/voice.ts", "utf8");
    expect(voice).toContain("Pau Pau has enough of your voice to coach you.");
    expect(source).toContain("readyVoiceLine");
    expect(source).toContain("Starting the stance interview…");
    expect(source).toContain("Somewhat comfortable");
    expect(source).not.toContain("grade-level");
    expect(source).not.toContain("words per sentence");
    expect(source).not.toContain("words that sound like you");
  });
});
