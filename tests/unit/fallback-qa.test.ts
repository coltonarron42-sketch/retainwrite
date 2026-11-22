import { describe, expect, it } from "vitest";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { plausibleTopic } from "@/lib/assignment/plausible";

const QA = `ENG 101: College Composition
Department of English  ·  Fall 2026
Instructor: Prof. Dana Ruiz
Argumentative Essay
Due date: December 12, 2026
Length: 1,200–1,500 words
Citation style: MLA 9 (MLA Handbook, 9th edition)
Topic
Should high schools start later in the morning?
Prompt question
Should U.S. high schools delay start times to 8:30 AM or later?
Assignment
Write an argumentative essay that takes a clear, defensible position on the prompt. Your thesis should appear in the introduction and guide the rest of the paper. Support your claims with scholarly evidence, address at least one serious counterargument.
Required sources
Use at least three scholarly sources. Cite every source in MLA 9, and include a Works Cited page (not counted in the word range).`;

describe("rule fallback on the QA sheet", () => {
  it("reads the range, not the 500 out of 1,500, and the labeled topic", () => {
    const req = parseAssignmentFallback(QA, { allowTopicAndDueDateGuess: false });
    expect(req.length.value).toMatchObject({ wordsMin: 1200, wordsMax: 1500 });
    expect(req.topic.value).toBe("Should high schools start later in the morning?");
    expect(req.promptQuestion.value).toBe("Should U.S. high schools delay start times to 8:30 AM or later?");
  });
  it("rejects fragments as topics", () => {
    expect(plausibleTopic("the prompt. Your thesis should appear in")).toBe(false);
    expect(plausibleTopic("the prompt. Your thesis should appear in the introduction and guide the rest of the paper")).toBe(false);
    expect(plausibleTopic("Should U.S. high schools delay start times?")).toBe(true);
    expect(plausibleTopic("How sampling bias affects survey results")).toBe(true);
    expect(plausibleTopic("Times New Roman 12 pt, double-spaced")).toBe(false);
  });
});
