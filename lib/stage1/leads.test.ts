import { describe, expect, it } from "vitest";
import { assertLeadDefaults, createLead } from "@/lib/stage1/leads";

describe("research leads", () => {
  it("defaults to to_verify", () => {
    const lead = createLead({
      name: "Example founder",
      whyAssignment: "Speaks to the margin requirement.",
    });
    expect(lead.status).toBe("to_verify");
    assertLeadDefaults(lead);
  });

  it("requires whyInterest for interest-steered leads", () => {
    expect(() =>
      createLead({
        name: "Musician",
        whyAssignment: "Fits the prompt",
        steeredBy: "both",
      }),
    ).toThrow(/whyInterest/);
  });

  it("attaches hook note when scholarly required", () => {
    const lead = createLead({
      name: "Founder",
      whyAssignment: "Business angle",
      scholarlyRequired: true,
    });
    expect(lead.hookOrExampleNote).toMatch(/scholarly/i);
  });
});
