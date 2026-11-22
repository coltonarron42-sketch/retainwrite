import { describe, expect, it } from "vitest";
import { emptyRequirements } from "@/lib/assignment/schema";
import { sanitizeParsedRequirements } from "@/lib/assignment/parse";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { assertAssignmentConfirmGate } from "@/lib/assignment/confirm";

const sheet = `HIST 210 Research Paper
Prompt: How did the New Deal change the relationship between Americans and the federal government?
Length: 5-6 pages. Citation style: Chicago 17 notes-bibliography. At least five peer-reviewed sources.`;

describe("an extracted 'other' citation style with no name never dead-ends the confirm gate", () => {
  it("falls back to the style the sheet names", () => {
    const primary = emptyRequirements();
    primary.citationStyle = { ...primary.citationStyle, value: "other", confidence: 0.9 };
    const out = sanitizeParsedRequirements(primary, parseAssignmentFallback(sheet, { allowTopicAndDueDateGuess: false }));
    expect(out.citationStyle.value).not.toBe("other");
    expect(String(out.citationStyle.value ?? "")).toMatch(/^Chicago/);
    expect(assertAssignmentConfirmGate(out).ok).toBe(true);
  });
  it("with nothing named on the sheet it is simply not specified (gate passes)", () => {
    const primary = emptyRequirements();
    primary.topic = { ...primary.topic, value: "The New Deal", confidence: 0.9 };
    primary.citationStyle = { ...primary.citationStyle, value: "other", confidence: 0.9 };
    const out = sanitizeParsedRequirements(primary, emptyRequirements());
    expect(out.citationStyle.value).toBeNull();
    expect(assertAssignmentConfirmGate(out).ok).toBe(true);
  });
  it("a named 'other' style is kept", () => {
    const primary = emptyRequirements();
    primary.citationStyle = { ...primary.citationStyle, value: "other", confidence: 0.9 };
    primary.citationStyleOther = "Bluebook";
    expect(sanitizeParsedRequirements(primary, emptyRequirements()).citationStyle.value).toBe("other");
  });
});

import { flatToNested, otherStyleName } from "@/lib/assignment/flat-parse";

describe("a style outside the list keeps its name (QA 11:48 #9)", () => {
  it("names the style from the evidence quote", () => {
    expect(otherStyleName("Citation style: ASA 6th edition.")).toBe("ASA 6th edition");
    expect(otherStyleName("Use Turabian style for notes.")).toBe("Turabian");
    expect(otherStyleName("Cite everything in CSE format")).toBe("CSE");
    expect(otherStyleName("")).toBeNull();
  });
  it("the model's 'other' with evidence becomes a named style", () => {
    const nested = flatToNested({ topic: "Teen sleep", citationStyle: "other", evidence: { citationStyle: "Citation style: ASA" } }) as Record<string, unknown>;
    expect(nested.citationStyleOther).toBe("ASA");
  });
});
