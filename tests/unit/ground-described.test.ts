import { describe, expect, it } from "vitest";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import { groundToDescription } from "@/lib/assignment/ground-described";
import { pauPauSummary } from "@/lib/stage1/pau-pau";

function modelRead() {
  const r = emptyRequirements();
  r.paperType = extractedField("research paper", 0.9);
  r.topic = extractedField("whether high schools should start later", 0.9);
  r.length = extractedField({ pagesMin: 5, pagesMax: 5 }, 0.9);
  r.citationStyle = extractedField("APA 7" as const, 0.9);
  r.requiredSources = extractedField({ countMin: 4, scholarlyRequired: true, types: "peer-reviewed journal articles" }, 0.9);
  r.dueDate = extractedField("December 12", 0.9);
  r.structuralRequirements = extractedField(["A clear thesis", "Counterargument paragraph"], 0.9);
  return r;
}

describe("typed descriptions: only the facts the student gave", () => {
  it("drops an invented paper type, source count, style, date and structure", () => {
    const g = groundToDescription(modelRead(), "essay on whether high schools should start later");
    expect(g.paperType.value).toBe("essay");
    expect(g.length.value).toBeNull();
    expect(g.citationStyle.value).toBeNull();
    expect(g.requiredSources.value).toBeNull();
    expect(g.dueDate.value).toBeNull();
    expect(g.structuralRequirements.value).toEqual([]);
    expect(g.topic.value).toBe("whether high schools should start later");
    const text = pauPauSummary(g);
    expect(text).not.toMatch(/research|four|4|APA|scholarly|December/);
  });

  it("keeps what was said, in the student's words", () => {
    const g = groundToDescription(
      modelRead(),
      "A 5 page APA paper on whether high schools should start later. Use at least 4 peer-reviewed sources. Due December 12.",
    );
    expect(g.paperType.value).toBe("paper");
    expect(g.length.value).toMatchObject({ pagesMin: 5 });
    expect(g.citationStyle.value).toBe("APA 7");
    expect(g.requiredSources.value).toMatchObject({ countMin: 4, scholarlyRequired: true });
    expect(g.dueDate.value).toBe("December 12");
    expect(pauPauSummary(g)).toContain("at least four peer-reviewed sources");
  });

  it("spelled-out numbers count", () => {
    const g = groundToDescription(modelRead(), "five pages, APA, four sources, on whether high schools should start later");
    expect(g.length.value).toMatchObject({ pagesMin: 5 });
    expect(g.requiredSources.value?.countMin).toBe(4);
    expect(g.requiredSources.value?.scholarlyRequired).toBeUndefined();
  });
});
