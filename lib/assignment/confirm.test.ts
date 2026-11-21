import { describe, expect, it } from "vitest";
import {
  assertAssignmentConfirmGate,
  confirmAllFields,
} from "@/lib/assignment/confirm";
import {
  emptyRequirements,
  extractedField,
} from "@/lib/assignment/schema";

describe("assignment confirm gate", () => {
  it("confirms missing fields as Not specified in one pass", () => {
    const gate = assertAssignmentConfirmGate(emptyRequirements());
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.requirements.topic.confirmed).toBe(true);
    expect(gate.requirements.topic.source).toBe("student_entered");
    expect(gate.requirements.length.confirmed).toBe(true);
  });

  it("rejects citationStyle other without a description", () => {
    const req = emptyRequirements();
    req.citationStyle = extractedField("other", 0.9);
    const gate = assertAssignmentConfirmGate(req);
    expect(gate.ok).toBe(false);
  });

  it("preserves extracted values when confirming", () => {
    let req = emptyRequirements();
    req.topic = extractedField("Margin pricing", 0.9);
    req = confirmAllFields(req);
    expect(req.topic.value).toBe("Margin pricing");
    expect(req.topic.confirmed).toBe(true);
  });
});
