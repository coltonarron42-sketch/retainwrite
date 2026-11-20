import { describe, expect, it } from "vitest";
import { needsAiPolicyAck } from "@/lib/assignment/ai-policy-notice";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";

describe("needsAiPolicyAck", () => {
  it("triggers on forbidden or restricted policy", () => {
    const req = emptyRequirements();
    req.aiPolicy = extractedField("forbidden", 0.9, "no AI");
    expect(needsAiPolicyAck(req)).toBe(true);
    req.aiPolicy = extractedField("restricted", 0.8);
    expect(needsAiPolicyAck(req)).toBe(true);
  });

  it("triggers on forbid phrases in raw text", () => {
    const req = emptyRequirements();
    expect(
      needsAiPolicyAck(req, "Students must not use AI tools on this paper."),
    ).toBe(true);
  });

  it("does not trigger for unspecified", () => {
    expect(needsAiPolicyAck(emptyRequirements(), "Write about climate.")).toBe(
      false,
    );
  });
});
