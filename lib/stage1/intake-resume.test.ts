import { describe, expect, it } from "vitest";
import { resumeQuestionIndex } from "@/lib/stage1/intake-resume";

describe("intake resume", () => {
  it("continues at the first question that was not saved", () => {
    expect(resumeQuestionIndex(["a", "b", "c"], ["a"])).toBe(1);
    expect(resumeQuestionIndex(["a", "b"], ["a", "b"])).toBe(2);
    expect(resumeQuestionIndex(["a", "b"], [])).toBe(0);
  });
});
