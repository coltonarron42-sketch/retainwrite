import { describe, expect, it } from "vitest";
import { resumeIntake, resumeQuestionIndex, stanceStartBlockers } from "@/lib/stage1/intake-resume";

describe("intake resume", () => {
  it("continues at the first question that was not saved", () => {
    expect(resumeQuestionIndex(["a", "b", "c"], ["a"])).toBe(1);
    expect(resumeQuestionIndex(["a", "b"], ["a", "b"])).toBe(2);
    expect(resumeQuestionIndex(["a", "b"], [])).toBe(0);
  });

  it("does not replay get-to-know-you after later answers, and returns to the gate after stance", () => {
    const plan = ["interest_1", "interest_2", "bg_comfort", "coaching_take", "personal_1"];
    expect(resumeIntake(plan, ["bg_comfort", "coaching_take"])).toMatchObject({
      skipInterest: true,
      screen: "coaching",
      index: 2,
    });
    expect(resumeIntake(plan, ["interest_1", "stance_early"]).screen).toBe("gate");
  });

  it("says why Start stance interview is unavailable", () => {
    expect(
      stanceStartBlockers({
        checklistConfirmed: true,
        hasStory: false,
        voiceOk: true,
        stanceOk: true,
      }),
    ).toEqual(["Pick a story angle first."]);
    expect(
      stanceStartBlockers({
        checklistConfirmed: true,
        hasStory: true,
        voiceOk: true,
        stanceOk: true,
      }),
    ).toEqual([]);
  });
});
