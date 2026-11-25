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

describe("Pau bubble", () => {
  it("says back the assignment conversationally", () => {
    const text = pauPauSummary(req());
    expect(text).toBe(
      "Okay, I've read it. This is for STAT 101 with Mr. Nelson: a 5–7 page paper in APA 7 format. You'll need a conclusion and a title page. Formatting: double-spaced. You'll be writing about how sampling bias affects survey results. You ready to get rolling?",
    );
  });
  it("asks for sources one thing at a time when the sheet requires them", () => {
    const r = req();
    r.requiredSources = extractedField({ countMin: 3, types: "scholarly sources", notes: "Must include: AAP (2014) policy statement" }, 0.9);
    expect(sourcesMissing(r)).toBe(true);
    expect(pauPauNextAsk(r, new Set())).toBe("sources");
    expect(pauPauNextAsk(r, new Set(["sources"]))).toBe(null);
    const text = pauPauSummary(r, { pendingAsk: "sources" });
    expect(text).toContain("It calls for at least three scholarly sources, including AAP (2014) policy statement.");
    expect(text).toContain("That covers most of it.");
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
    expect(text).toContain("You'll need a clear thesis in your introduction, a counterargument you answer, and a title page.");
  });
  it("covers the real QA sheet: Works Cited, thesis, named AAP source, rubric, formatting", () => {
    const r = emptyRequirements();
    r.course = extractedField("ENG 102 – Composition II", 0.9);
    r.instructor = extractedField("Prof. Dana Ruiz", 0.9);
    r.paperType = extractedField("argumentative essay", 0.9);
    r.citationStyle = extractedField("MLA 9" as const, 0.9);
    r.length = extractedField({ wordsMin: 1200, wordsMax: 1500 }, 0.9);
    r.structuralRequirements = extractedField(
      ["thesis should appear in the introduction", "address at least one serious counterargument", "include a Works Cited page (not counted in the word range)"],
      0.9,
    );
    r.formattingRules = extractedField(["Times New Roman 12 pt", "double-spaced", "1-inch margins", "Works Cited page"], 0.9);
    r.requiredSources = extractedField(
      {
        countMin: 3,
        types: "scholarly sources; one must be the American Academy of Pediatrics 2014 policy statement",
        notes: 'Must include: American Academy of Pediatrics. "School Start Times for Adolescents." Pediatrics, vol. 134, no. 3, 2014, pp. 642–649.',
      },
      0.9,
    );
    r.rubricCriteria = extractedField(
      [{ name: "Thesis & Argument (30%)" }, { name: "Use of Evidence (30%)" }, { name: "Organization (20%)" }, { name: "MLA Formatting & Mechanics (20%)" }],
      0.9,
    );
    r.topic = extractedField("Should high schools start later?", 0.9);
    const text = pauPauSummary(r);
    expect(text).not.toMatch(/\ba address\b|\ba a\b|\ba an\b/);
    expect(text).toContain("This is for ENG 102 with Prof. Dana Ruiz: a 1,200–1,500 word argumentative essay in MLA 9 format.");
    expect(text).toContain("You'll need a clear thesis in your introduction, a counterargument you answer, and a Works Cited page.");
    expect(text).toContain("including the American Academy of Pediatrics' “School Start Times for Adolescents” (2014)");
    expect(text).toContain("Formatting: Times New Roman 12 pt, double-spaced, and 1-inch margins.");
    expect(text).toContain("You'll be graded on thesis and argument, use of evidence, organization, and MLA formatting and mechanics.");
  });
});

describe("Pau on a weak (rule fallback) read", () => {
  it("never states low-confidence facts or a fragment topic; asks for the topic", async () => {
    const { capFallbackConfidence } = await import("@/lib/assignment/parse");
    const r = emptyRequirements();
    r.course = extractedField("ENG 101: College Composition", 0.8);
    r.topic = extractedField("the prompt. Your thesis should appear in", 0.7);
    r.length = extractedField({ wordsMin: 500, wordsMax: 500 }, 0.6);
    r.citationStyle = extractedField("MLA 9" as const, 0.85);
    const capped = capFallbackConfidence(r);
    const text = pauPauSummary(capped, { pendingAsk: pauPauNextAsk(capped, new Set()) });
    expect(text).not.toMatch(/500|the prompt|thesis should/);
    expect(text).toContain("I couldn't make out every detail");
    expect(pauPauNextAsk(capped, new Set())).toBe("topic");
  });
});
