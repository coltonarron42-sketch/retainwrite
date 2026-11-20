import { describe, expect, it } from "vitest";
import { dropInvalidEvidence, isVerbatimEvidence } from "@/lib/assignment/evidence";

describe("rawEvidence", () => {
  it("requires substring evidence", () => {
    const source = "Write a 5-page APA essay on climate policy.";
    expect(isVerbatimEvidence("APA", source)).toBe(true);
    expect(isVerbatimEvidence("MLA", source)).toBe(false);
    expect(dropInvalidEvidence({ rawEvidence: "MLA", confidence: 1 }, source)).not.toHaveProperty(
      "rawEvidence",
    );
  });
});
