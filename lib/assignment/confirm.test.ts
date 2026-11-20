import { describe, expect, it } from "vitest";
import {
  assertAssignmentConfirmGate,
  markFieldConfirmed,
  markNotSpecified,
} from "@/lib/assignment/confirm";
import {
  emptyRequirements,
  extractedField,
  type AssignmentRequirements,
} from "@/lib/assignment/schema";

function confirmAll(req: AssignmentRequirements): AssignmentRequirements {
  return {
    ...req,
    course: markFieldConfirmed(req.course),
    paperType: markFieldConfirmed(req.paperType),
    topic: markFieldConfirmed(req.topic),
    promptQuestion: markFieldConfirmed(req.promptQuestion),
    length: markFieldConfirmed(req.length),
    citationStyle: markFieldConfirmed(req.citationStyle),
    formattingRules: markFieldConfirmed(req.formattingRules),
    requiredSources: markFieldConfirmed(req.requiredSources),
    providedReadings: markFieldConfirmed(req.providedReadings),
    structuralRequirements: markFieldConfirmed(req.structuralRequirements),
    dueDate: markFieldConfirmed(req.dueDate),
    rubricCriteria: markFieldConfirmed(req.rubricCriteria),
    otherInstructions: markFieldConfirmed(req.otherInstructions),
    aiPolicy: markFieldConfirmed(req.aiPolicy),
    language: markFieldConfirmed(req.language),
  };
}

describe("assignment confirm gate", () => {
  it("fails when fields are unreviewed", () => {
    const req = emptyRequirements();
    req.topic = extractedField("Climate policy", 0.9);
    const gate = assertAssignmentConfirmGate(req);
    expect(gate.ok).toBe(false);
  });

  it("passes with required fields confirmed and Not specified length/citation", () => {
    let req = emptyRequirements();
    req.topic = extractedField("Margin pricing", 0.9);
    req = confirmAll(req);
    req.promptQuestion = markNotSpecified(req.promptQuestion);
    req.length = markNotSpecified(req.length);
    req.citationStyle = markNotSpecified(req.citationStyle);

    expect(assertAssignmentConfirmGate(req).ok).toBe(true);
  });
});
