import { describe, expect, it } from "vitest";
import { isThinAnswer, keptIdeas } from "./thin";

describe("isThinAnswer", () => {
  it("flags short answers", () => {
    expect(isThinAnswer("too short", 10).thin).toBe(true);
  });

  it("flags stock phrases", () => {
    expect(isThinAnswer("idk", 1).reason).toBe("stock");
  });

  it("accepts substantial answers", () => {
    const text =
      "I think climate policy fails when it ignores local jobs and community buy-in over time.";
    expect(isThinAnswer(text, 10).thin).toBe(false);
    expect(keptIdeas(["idk", "Listening mattered because the coach stayed."])).toEqual([
      "Listening mattered because the coach stayed.",
    ]);
  });
});
