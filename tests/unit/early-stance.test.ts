import { describe, expect, it } from "vitest";
import { earlyStanceQuestion } from "@/lib/stage1/early-stance";

describe("early stance question", () => {
  it("uses the confirmed topic", () => {
    expect(earlyStanceQuestion({ topic: "later school start times", promptQuestion: null })).toBe(
      "What's your early take on later school start times?",
    );
  });
  it("uses the assignment question when there is no topic", () => {
    expect(
      earlyStanceQuestion({ topic: "", promptQuestion: "Should high schools start later in the morning?" }),
    ).toBe("The assignment asks: Should high schools start later in the morning? What's your early take?");
  });
  it("never nests a question or a placeholder topic", () => {
    const q = earlyStanceQuestion({ topic: "this question", promptQuestion: null });
    expect(q).toBe("What's your early take on this assignment?");
    expect(q).not.toMatch(/moment from your own life/);
  });
  it("lowercases a leading function word but keeps proper nouns", () => {
    expect(earlyStanceQuestion({ topic: "Whether high schools should start later in the morning" })).toBe(
      "What's your early take on whether high schools should start later in the morning?",
    );
    expect(earlyStanceQuestion({ topic: "English 101 argument essay" })).toBe(
      "What's your early take on English 101 argument essay?",
    );
  });
  it("falls back to clean wording", () => {
    expect(earlyStanceQuestion({})).toBe("What's your early take on this assignment?");
  });
});
