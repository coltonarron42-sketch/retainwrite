import { describe, expect, it } from "vitest";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import { lengthFromAnswer, pauPauNextAsk, pauPauSummary, sourcesMissing } from "@/lib/stage1/pau-pau";

function req() {
  const r = emptyRequirements();
  r.citationStyle = extractedField("APA 7" as const, 0.9);
  r.course = extractedField("STAT 101 - Introduction to Statistics", 0.9);
  r.instructor = extractedField("Mr. Nelson", 0.9);
  r.length = extractedField({ pagesMin: 5, pagesMax: 7 }, 0.9);
  r.formattingRules = extractedField(["Title page", "Double-spaced"], 0.9);
  r.structuralRequirements = extractedField(["Conclusion"], 0.9);
  r.topic = extractedField("How sampling bias affects survey results", 0.9);
  return r;
}

describe("Pau Pau bubble", () => {
  it("says back the assignment conversationally", () => {
    const text = pauPauSummary(req());
    expect(text).toBe(
      "Okay, let's see here… looks like APA format, STAT 101, Mr. Nelson's class, a 5–7 page paper, a title page, and a conclusion. You'll be writing about how sampling bias affects survey results. This is totally doable. You ready to get rolling?",
    );
  });
  it("asks for sources one thing at a time when the sheet requires them", () => {
    const r = req();
    r.requiredSources = extractedField({ countMin: 3, types: "scholarly sources", notes: "Must include: AAP (2014) policy statement" }, 0.9);
    expect(sourcesMissing(r)).toBe(true);
    expect(pauPauNextAsk(r, new Set())).toBe("sources");
    expect(pauPauNextAsk(r, new Set(["sources"]))).toBe(null);
    const text = pauPauSummary(r, { pendingAsk: "sources" });
    expect(text).toContain("at least three scholarly sources, including AAP (2014) policy statement");
    expect(text).toContain("Looks good so far.");
  });
  it("topic is asked first and cannot be skipped", () => {
    const r = req();
    r.topic = emptyRequirements().topic;
    expect(pauPauNextAsk(r, new Set(["topic" as never]))).toBe("topic");
  });
  it("reads a typed length", () => {
    expect(lengthFromAnswer("1,200-1,500 words")).toMatchObject({ wordsMin: 1200, wordsMax: 1500 });
    expect(lengthFromAnswer("5 to 7 pages")).toMatchObject({ pagesMin: 5, pagesMax: 7 });
  });
  it("skips full-sentence structure rules and keeps short parts", () => {
    const r = req();
    r.structuralRequirements = extractedField(
      ["Your thesis should appear in the first paragraph", "Include one paragraph that answers a counterargument"],
      0.9,
    );
    const text = pauPauSummary(r);
    expect(text).not.toMatch(/should appear/);
    expect(text).toContain("one paragraph that answers a counterargument");
  });
});
