import { describe, expect, it } from "vitest";
import { intakeScreenAfterLoad } from "@/lib/stage1/intake-resume";
import { draftPointer, restoreDraftText } from "@/lib/papers/draft-resume";

describe("mid-answer autosave", () => {
  it("keeps a half-typed Stage 1 answer on the current question", () => {
    expect(draftPointer({ stage: 1, questionId: "coaching_take" })).toEqual({
      stage: 1,
      questionId: "coaching_take",
      screen: "coaching",
    });
    expect(
      intakeScreenAfterLoad({
        resumeScreen: "coaching",
        resumeQuestionId: "coaching_take",
        hasAnswers: false,
      }),
    ).toBe("coaching");
    expect(
      restoreDraftText(
        [{ fieldKey: "stage1:coaching_take", text: "I mostly follow the team chat after practice" }],
        "coaching_take",
      ),
    ).toBe("I mostly follow the team chat after practice");
  });

  it("does not open the checklist when that draft exists and no answer is submitted yet", () => {
    expect(intakeScreenAfterLoad({ resumeScreen: null, resumeQuestionId: null, hasAnswers: false })).toBe("card");
    expect(
      intakeScreenAfterLoad({
        resumeScreen: draftPointer({ stage: 1, questionId: "personal_1" }).screen,
        resumeQuestionId: "personal_1",
        hasAnswers: false,
      }),
    ).toBe("coaching");
  });
});
