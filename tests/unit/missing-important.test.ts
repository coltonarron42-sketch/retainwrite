import { describe, expect, it } from "vitest";
import { missingImportant } from "@/lib/assignment/missing-important";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";

describe("missingImportant", () => {
  it("is true on an empty card", () => {
    expect(missingImportant(emptyRequirements())).toBe(true);
  });

  it("is false when prompt + length + citation + rubric + structure are strong", () => {
    const req = emptyRequirements();
    req.topic = extractedField("Margin for owners", 0.9, "margin");
    req.length = extractedField({ pagesMin: 5, pagesMax: 7, raw: "5–7 pages" }, 0.9);
    req.citationStyle = extractedField("APA 7", 0.9, "APA");
    req.rubricCriteria = extractedField([{ name: "Analysis" }], 0.8);
    req.structuralRequirements = extractedField(["Intro", "Body", "Conclusion"], 0.8);
    expect(missingImportant(req)).toBe(false);
  });

  it("is true when length confidence is below 0.4", () => {
    const req = emptyRequirements();
    req.topic = extractedField("Topic", 0.9);
    req.length = extractedField({ raw: "maybe long" }, 0.2);
    req.citationStyle = extractedField("APA 7", 0.9);
    req.rubricCriteria = extractedField([{ name: "X" }], 0.8);
    req.structuralRequirements = extractedField(["Intro"], 0.8);
    expect(missingImportant(req)).toBe(true);
  });
});
