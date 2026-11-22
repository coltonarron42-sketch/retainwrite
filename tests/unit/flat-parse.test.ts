import { describe, expect, it } from "vitest";
import { parseAssignmentCorpus } from "@/lib/assignment/parse";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";

const CORPUS = `ENG 102 – Composition II
Instructor: Dr. Maria Lopez
Argumentative Essay: Should high schools start classes later in the morning?
Length: 1,200–1,500 words. MLA 9. Times New Roman 12 pt, double-spaced, 1-inch margins.
Use at least three scholarly sources, including the American Academy of Pediatrics (2014) policy statement.
Due: March 14
Grading
Thesis and argument – 30 points
Use of evidence – 30 points
Organization – 20 points
MLA formatting – 20 points`;

const FLAT = {
  course: "ENG 102 – Composition II",
  instructor: "Dr. Maria Lopez",
  paperType: "argumentative essay",
  topic: "Should high schools start classes later in the morning?",
  promptQuestion: "Should high schools start classes later in the morning?",
  lengthText: "1,200–1,500 words",
  wordsMin: 1200,
  wordsMax: 1500,
  pagesMin: null,
  pagesMax: null,
  citationStyle: "MLA 9",
  formattingRules: ["Times New Roman 12 pt", "double-spaced", "1-inch margins"],
  sourcesCountMin: 3,
  sourceTypes: "scholarly sources",
  specificRequiredSources: ["American Academy of Pediatrics (2014) policy statement"],
  providedReadings: [],
  structuralRequirements: [],
  dueDate: "March 14",
  rubricCriteria: [
    { name: "Thesis and argument", weight: 30, description: null },
    { name: "Use of evidence", weight: 30, description: null },
    { name: "Organization", weight: 20, description: null },
    { name: "MLA formatting", weight: 20, description: null },
  ],
  otherInstructions: null,
  aiPolicy: "unspecified",
  evidence: { topic: null, length: "1,200–1,500 words", citationStyle: "MLA 9", dueDate: "Due: March 14", instructor: "Instructor: Dr. Maria Lopez" },
};

describe("flat assignment read", () => {
  it("maps rubric, named sources, instructor and formatting onto the card", async () => {
    const result = await parseAssignmentCorpus(CORPUS, {
      mode: "live",
      askModel: async () => ({ ok: true, text: JSON.stringify(FLAT), model: "grok-test" }),
    });
    const req = result.requirements;
    expect(result.parseMeta.fallback).toBe(false);
    expect(req.instructor?.value).toBe("Dr. Maria Lopez");
    expect(req.rubricCriteria.value?.map((c) => c.name)).toEqual([
      "Thesis and argument",
      "Use of evidence",
      "Organization",
      "MLA formatting",
    ]);
    expect(req.rubricCriteria.value?.[0].weight).toBe(30);
    expect(req.requiredSources.value?.notes).toMatch(/American Academy of Pediatrics \(2014\)/);
    expect(req.requiredSources.value?.countMin).toBe(3);
    expect(req.formattingRules.value).toContain("double-spaced");
    expect(req.length.value?.wordsMin).toBe(1200);
    expect(req.length.value?.wordsMax).toBe(1500);
    expect(req.citationStyle.value).toBe("MLA 9");
  });
  it("rule read finds the instructor", () => {
    expect(parseAssignmentFallback(CORPUS).instructor?.value).toBe("Dr. Maria Lopez");
  });
});
