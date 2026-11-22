import { describe, expect, it } from "vitest";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { fillEmptyRequirements, sanitizeParsedRequirements } from "@/lib/assignment/parse";
import { emptyRequirements } from "@/lib/assignment/schema";

const SHEET = "SOC 210 Research Paper. Prompt: How does social media use affect teen friendships? Write 1,500 words with at least four peer-reviewed sources. Citation style: ASA. Due December 10.";

describe("a labeled style outside the list keeps its name (QA 11:48 #9, E2E 1:31 PM)", () => {
  it("rules fallback names ASA", () => {
    const r = parseAssignmentFallback(SHEET);
    expect(r.citationStyle.value).toBe("other");
    expect(r.citationStyleOther).toBe("ASA");
  });
  it("a model read that missed the style is filled with the named style", () => {
    const extra = parseAssignmentFallback(SHEET);
    const filled = fillEmptyRequirements(emptyRequirements(), extra);
    expect(filled.citationStyle.value).toBe("other");
    expect(filled.citationStyleOther).toBe("ASA");
  });
  it("known styles are unchanged", () => {
    expect(parseAssignmentFallback("Essay. Use MLA format. 900 words.").citationStyle.value).toBe("MLA 9");
    expect(parseAssignmentFallback("Essay. 900 words.").citationStyle.value).toBeNull();
  });
  it("sanitize keeps it", () => {
    const extra = parseAssignmentFallback(SHEET);
    expect(sanitizeParsedRequirements).toBeTypeOf("function");
    expect(extra.citationStyleOther).toBe("ASA");
  });
});
