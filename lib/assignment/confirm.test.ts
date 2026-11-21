import { readFileSync } from "node:fs";
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
  it("rejects an empty topic and prompt, then confirms the other fields", () => {
    const blocked = assertAssignmentConfirmGate(emptyRequirements());
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reasons[0]).toMatch(/topic or the prompt/i);

    const req = emptyRequirements();
    req.topic = extractedField("How social media affects teens", 0.8);
    const gate = assertAssignmentConfirmGate(req);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.requirements.topic.value).toMatch(/social media/i);
    expect(gate.requirements.length.confirmed).toBe(true);
    expect(gate.requirements.length.source).toBe("student_entered");
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

  it("clears the confirm error once a topic is typed", () => {
    const source = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(source).toContain('id="confirm-error"');
    expect(source).toContain("scrollIntoView");
    const edit = source.indexOf('if (key === "topic" || key === "promptQuestion")');
    expect(source.slice(edit, edit + 280)).toContain("setError(null)");
  });
});
