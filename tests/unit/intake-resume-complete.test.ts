import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("intake resume after every question is answered", () => {
  it("rebuilds the fallback question and reopens Pick your story instead of a blank step", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain('answer.questionId === "fallback_voice"');
    expect(intake).toContain("setNeedFallback(true);\n      return;");
    expect(intake).toContain("else finishCoaching(answers);");
    expect(intake).toContain("if (qIndex >= coachingPlan.length && coachingPlan.length > 0) finishCoaching(answers);");
  });
});
