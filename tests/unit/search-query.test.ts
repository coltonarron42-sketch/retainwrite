import { describe, expect, it } from "vitest";
import { createLead, leadLinks, leadSearchTerms, practitionerSearchTerms, searchQuery, topicKeywords, trimAtWord } from "@/lib/stage1/leads";

// QA (#78 gate): "which leadership style is most effective for leading a team through ch practitioner interview c…".
const TOPIC = "which leadership style is most effective for leading a team through change";

describe("gate search links: keywords, trimmed at a word boundary", () => {
  it("the topic's core terms, never its filler words", () => {
    expect(topicKeywords(TOPIC)).toEqual(["leadership", "style", "leading", "team", "change"]);
  });
  it("leader, then styles, then the core topic terms", () => {
    expect(searchQuery(TOPIC, { leader: "Sam Walton", styles: ["servant", "transformational"] })).toBe("Sam Walton servant transformational leadership style leading team change");
  });
  it("the practitioner search keeps its own words whole and never cuts a word", () => {
    const q = practitionerSearchTerms(TOPIC, null, { leader: "Sam Walton", styles: ["servant"] })!;
    expect(q).toBe("Sam Walton servant leadership style leading team change practitioner interview case study");
    expect(q).not.toMatch(/\bch\b|\bc$/);
    const long = practitionerSearchTerms(`${TOPIC} in large multinational retail organizations during periods of rapid technological disruption`, "basketball")!;
    expect(long.endsWith("practitioner interview case study basketball")).toBe(true);
    for (const w of long.split(" ")) expect(`${TOPIC} large multinational retail organizations during periods rapid technological disruption practitioner interview case study basketball`.toLowerCase()).toContain(w.toLowerCase());
  });
  it("trimAtWord never ends mid-word", () => {
    expect(trimAtWord("leading a team through change and growth", 26)).toBe("leading a team through");
    expect(trimAtWord("short", 26)).toBe("short");
  });
  it("links carry the keyword query; interest-steered still leads with the interest", () => {
    expect(leadSearchTerms("teen sleep", "soccer")).toBe("soccer teen sleep");
    const lead = createLead({ name: "x", whyAssignment: "y", searchTerms: leadSearchTerms(TOPIC, null, { leader: "Sam Walton", styles: ["servant"] }) });
    expect(decodeURIComponent(leadLinks(lead)[0]!.href)).toBe("https://scholar.google.com/scholar?q=Sam Walton servant leadership style leading team change");
    // An old lead with no saved terms: the topic's keywords, whole words.
    expect(decodeURIComponent(leadLinks(createLead({ name: "old", whyAssignment: "y" }), TOPIC)[0]!.href)).toBe("https://scholar.google.com/scholar?q=leadership style leading team change");
  });
});
