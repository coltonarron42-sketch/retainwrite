import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { coerceRequirements } from "@/lib/assignment/coerce";
import { checklistLabel, readingFields } from "@/lib/stage1/lock-in";
import { inlineLabel, isReadingItem, stripLead } from "@/lib/stage1/reading-label";
import { displayWork, mustWithReadings, namedWorksFrom, readingsLineWorks } from "@/lib/stage1/readings";
import { informedAffirm, requirementLines } from "@/lib/stage1/north-turns";
import { stage2IntroText } from "@/lib/stages/stage2-intro";

// QA #84's exact sheets (prod e1dd9fff and b3d40615).
const E1 = "BUS 210 Leadership essay for Prof. Kim. Readings: Northouse, Leadership: Theory and Practice (Chapter 4) and Goleman, What Makes a Leader? (HBR). Write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
const B3 = "BUS 210 Leadership essay for Prof. Kim. Readings: Northouse ch. 4, pp. 45-70 and Goleman, What Makes a Leader? (HBR). Write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
// What the parse and the read-back model returned on prod.
const E1_PROVIDED = [{ title: "Northouse, Leadership: Theory and Practice (Chapter 4)" }, { title: "Goleman, What Makes a Leader? (HBR)" }];
const B3_PROVIDED = [{ title: "Northouse ch. 4, pp. 45-70" }, { title: "Goleman, What Makes a Leader? (HBR)" }];
const E1_MODEL_MUST = ["Use Northouse, Leadership: Theory and Practice (Chapter 4)", "Use Goleman, What Makes a Leader? (HBR)", "APA 7 format", "One real leader as your example"];
const B3_MODEL_MUST = ["Northouse ch. 4 pp. 45-70", "Goleman, What Makes a Leader? (HBR)", "1,200-1,500 words"];
const E1_ASK = "You need to write a 1,200-1,500 word essay that argues which leadership style works best when leading a team through change and use one real leader as your example.";
const B3_ASK = "You need to write an essay that argues which leadership style works best for leading a team through change, using one real leader as your example.";

const NORTH = "The assigned chapter: Chapter 4 of Northouse, Leadership: Theory and Practice";
const NORTH_PP = "The assigned chapter: Chapter 4 (pp. 45–70) of Northouse";
const GOLE = "The assigned article: ‘What Makes a Leader?’ by Goleman (HBR)";

describe("QA #84 1: instruction verbs and prefixes never reach the label; articles are articles", () => {
  it("the exact QA strings", () => {
    expect(checklistLabel("Use Northouse, Leadership: Theory and Practice (Chapter 4)", E1)).toBe(NORTH);
    expect(checklistLabel("Use Goleman, What Makes a Leader? (HBR)", E1)).toBe(GOLE);
    expect(checklistLabel("Goleman, What Makes a Leader? (HBR)", B3)).toBe(GOLE);
  });
  it("every prefix and verb", () => {
    for (const lead of ["Use", "Read", "Cite", "Include", "Reference", "Readings:", "Required:", "Required readings:", "Read and cite", "Please use", "You must use", "Draw on", "Texts:", "Readings: Use"])
      expect(checklistLabel(`${lead} Northouse, Leadership: Theory and Practice (Chapter 4)`, ""), lead).toBe(NORTH);
    expect(stripLead("Readings: Read Goleman, What Makes a Leader?")).toBe("Goleman, What Makes a Leader?");
    // Not a reading: left as written.
    for (const x of ["Include APA 7 format", "Use one real leader as your example", "Reference list in APA", "APA 7 format"]) expect(checklistLabel(x, "")).toBe(x);
  });
  it("article detection: question titles, HBR/journal cues, known articles", () => {
    expect(readingFields("Goleman, What Makes a Leader? (HBR)")).toMatchObject({ type: "article", title: "What Makes a Leader?", author: "Goleman", source: "HBR" });
    expect(checklistLabel("What Makes a Leader? by Daniel Goleman", "")).toBe("The assigned article: ‘What Makes a Leader?’ by Daniel Goleman");
    expect(checklistLabel("Kotter, What Leaders Really Do", "")).toBe("The assigned article: ‘What Leaders Really Do’ by Kotter");
    expect(checklistLabel("Smith, Teams Under Pressure (Journal of Management)", "")).toMatch(/^The assigned article: ‘Teams Under Pressure/);
    expect(checklistLabel("Northouse, Leadership: Theory and Practice", "")).toBe("The assigned reading: Northouse, Leadership: Theory and Practice");
  });
});

describe("QA #84 2: ch./chap./chapter and page ranges anywhere", () => {
  it("the exact QA strings, with and without the comma", () => {
    expect(checklistLabel("Northouse ch. 4 pp. 45-70", B3)).toBe(NORTH_PP);
    expect(checklistLabel("Northouse ch. 4, pp. 45-70", B3)).toBe(NORTH_PP);
  });
  it("abbreviations", () => {
    for (const x of ["Northouse chap. 4", "Northouse Ch 4", "Northouse, chapter 4", "Read Northouse ch. 4", "Chap. 4 of Northouse"]) expect(checklistLabel(x, ""), x).toBe("The assigned chapter: Chapter 4 of Northouse");
    expect(checklistLabel("Northouse, pp. 45-70", "")).toBe("The assigned reading: pp. 45–70 of Northouse");
    expect(checklistLabel(NORTH_PP, "")).toBe(NORTH_PP);
    expect(displayWork("Northouse ch. 4, pp. 45-70")).toBe("Northouse Ch. 4");
  });
});

describe("QA #84 end to end: sheet → parse → read-back → checklist → Stage 2 recap", () => {
  for (const [name, sheet, provided, modelMust, ask] of [
    ["e1dd9fff", E1, E1_PROVIDED, E1_MODEL_MUST, E1_ASK],
    ["b3d40615", B3, B3_PROVIDED, B3_MODEL_MUST, B3_ASK],
  ] as const) {
    const expected = name === "e1dd9fff" ? [NORTH, GOLE] : [NORTH_PP, GOLE];
    it(`${name}: the parse names both readings (model parse, and the fallback parse from the "Readings:" line)`, () => {
      const modelReq = coerceRequirements({ providedReadings: provided }) as Parameters<typeof namedWorksFrom>[0];
      expect(namedWorksFrom(modelReq, sheet).map((w) => checklistLabel(w, ""))).toEqual(expected);
      const fallback = parseAssignmentFallback(sheet);
      expect(namedWorksFrom(fallback, sheet).map((w) => checklistLabel(w, ""))).toEqual(expected);
      expect(readingsLineWorks(sheet)).toHaveLength(2);
    });
    it(`${name}: read-back "must include" keeps every reading, in the parse's words`, () => {
      const works = namedWorksFrom(coerceRequirements({ providedReadings: provided }) as Parameters<typeof namedWorksFrom>[0], sheet);
      const must = mustWithReadings([...modelMust], works);
      expect(must.slice(0, 2)).toEqual(provided.map((p) => p.title));
      expect(must.some((m) => /^Use\b/.test(m))).toBe(false);
      // Checklist: the intake's mapping, then requirementLines (the choke point).
      const turn = informedAffirm("I read both. Satya Nadella, transformational.", { leader: "Satya Nadella", mustInclude: must.map((x) => checklistLabel(x, sheet)), needsPerson: true });
      for (const label of expected) expect(turn.some((l) => l.startsWith(`✓ ${label}`) || l.startsWith(`○ ${label}`)), label).toBe(true);
      expect(turn.join("\n")).not.toMatch(/\bof Use\b|: Use\b|○ Northouse ch\./);
      // Even raw items straight into the checklist builder come out pinned.
      const raw = requirementLines("Satya Nadella", { leader: "Satya Nadella", styles: [], mustInclude: [...modelMust], needsPerson: true });
      for (const label of expected) expect(raw.some((l) => l.includes(label)), label).toBe(true);
      // Stage 2 recap lists the readings, labeled the same way.
      const recap = stage2IntroText({ ask, mustInclude: must, graded: [] }, { heading: "", body: "" }).body;
      for (const label of expected) expect(recap).toContain(label);
      // The prod read-back as it was stored (before this fix) also lists them.
      expect(stage2IntroText({ ask, mustInclude: [...modelMust], graded: [] }, { heading: "", body: "" }).body).toContain(GOLE);
    });
  }
  it("Stage 1 read-back prose uses the same labels", () => {
    expect(inlineLabel("Use Goleman, What Makes a Leader? (HBR)")).toBe("the assigned article: ‘What Makes a Leader?’ by Goleman (HBR)");
    expect(inlineLabel("APA 7 format")).toBe("APA 7 format");
    expect(isReadingItem("1,200-1,500 words")).toBe(false);
  });
  it("wiring: the read-back adds the parse's works; recap and confirm label readings", () => {
    expect(readFileSync("lib/server/paper-context/brief.ts", "utf8")).toContain("o.mustInclude = mustWithReadings(cleanPoints(o.mustInclude, 4), a.namedWorks);");
    expect(readFileSync("lib/stages/stage2-intro.ts", "utf8")).toContain("items.filter(isReadingItem).map((x) => checklistLabel(x, \"\"))");
    expect(readFileSync("components/stages/stage1/pau-pau-confirm.tsx", "utf8")).toContain("p.mustInclude.map(inlineLabel)");
  });
});
