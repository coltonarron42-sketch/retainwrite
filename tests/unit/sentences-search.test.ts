import { describe, expect, it } from "vitest";
import { firstSentenceOf, splitSentences } from "@/lib/copy/sentences";
import { assignmentAlertQuote } from "@/lib/coaching/logicCheck";
import { exampleLeadBatch, searchKeywords, searchPhrase, sourceSearchDirections } from "@/lib/coaching/exampleLeads";

describe("sentences never break on abbreviations", () => {
  it("keeps U.S., Dr., a.m. and e.g. inside one sentence", () => {
    expect(firstSentenceOf("Should U.S. high schools start later in the morning? Take a clear position.")).toBe(
      "Should U.S. high schools start later in the morning?",
    );
    expect(firstSentenceOf("Prof. Dana Ruiz wants 8 a.m. classes moved, e.g. first period. Use MLA.")).toBe(
      "Prof. Dana Ruiz wants 8 a.m. classes moved, e.g. first period.",
    );
    expect(splitSentences("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
    expect(assignmentAlertQuote({ confirmedPrompt: "Should U.S. high schools start later in the morning? Argue it." })).toContain(
      "Should U.S. high schools start later in the morning?",
    );
  });
});

describe("search directions read as key words, not a broken sentence", () => {
  it("turns a question into key word groups", () => {
    expect(searchKeywords("high schools start later in the morning")).toBe("high schools start later, morning");
    const text = sourceSearchDirections("Should high schools start later in the morning?");
    expect(text).not.toMatch(/for “high schools start later in the morning”/);
    expect(searchPhrase("high schools start later in the morning")).toBe("high schools start later");
    expect(text).toContain("Try “high schools start later” in JSTOR, Google Scholar, or your school library, then add a word or two of your own.");
    expect(text).not.toMatch(/later, morning/);
  });

  it("question topics never get spliced into 'about …'", () => {
    const leads = exampleLeadBatch({
      concept: "Should high schools start later in the morning?",
      assignmentText: "Should high schools start later in the morning?",
      studentIdea: "",
      rubricRef: "thesis",
    } as Parameters<typeof exampleLeadBatch>[0]);
    const all = JSON.stringify(leads);
    expect(all).not.toMatch(/about high schools start later/);
    expect(all).not.toMatch(/“high schools start later in the morning”/);
  });
});
