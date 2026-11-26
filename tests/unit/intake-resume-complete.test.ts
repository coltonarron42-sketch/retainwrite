import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("intake resume after every question is answered", () => {
  it("keeps an answered legacy fallback question and reopens Pick your story instead of a blank step", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    // PC-32: the fallback voice question is never added again; an answered one stays in the plan.
    expect(intake).toContain('if (!northstar && has("fallback_voice")) {');
    expect(intake).not.toContain("setNeedFallback(true)");
    expect(intake).toContain("else finishCoaching(answers);");
    expect(intake).toContain("if (qIndex >= coachingPlan.length && coachingPlan.length > 0) {");
  });
});
