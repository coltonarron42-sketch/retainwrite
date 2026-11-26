import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readingNames } from "@/lib/copy/name-case";
import { checklistLabel, readingFields } from "@/lib/stage1/lock-in";
import { informedAffirm, requirementLines } from "@/lib/stage1/north-turns";
import { projectSkeleton, shapeFromModel, shapeSigOf, type ShapeOutline } from "@/lib/skeleton/shape";
import { bodyPlan, coverReadings, fitBodies, fixTitles, requiredReadings, varyTitles } from "@/lib/skeleton/tidy";

const SHEET = "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
const NORTH = "The assigned chapter: Chapter 4 of Northouse, Leadership: Theory and Practice";
const GOLE = "The assigned article: ‘What Makes a Leader?’ by Daniel Goleman (HBR)";

describe("QA prod smoke (after #83) 1: the reading label is pinned for every parse shape", () => {
  it("f8df7ccc's exact shape: 'Author, Title (Chapter N)'", () => {
    expect(checklistLabel("Northouse, Leadership: Theory and Practice (Chapter 4)", SHEET)).toBe(NORTH);
    expect(readingFields("Northouse, Leadership: Theory and Practice (Chapter 4)")).toMatchObject({ type: "chapter", chapter: "4", author: "Northouse" });
  });
  it("fuzz: title first, author last, Ch., pages", () => {
    for (const x of [
      "Northouse, Leadership: Theory and Practice (Chapter 4).",
      "Northouse, Leadership: Theory and Practice, Ch. 4",
      "Northouse, Leadership: Theory and Practice (ch 4)",
      "Leadership: Theory and Practice (Northouse), Chapter 4",
      "Leadership: Theory and Practice, Northouse (Ch. 4)",
      "the Northouse, Leadership: Theory and Practice (Chapter 4)",
      "Chapter 4 of Northouse, Leadership: Theory and Practice",
      NORTH,
    ]) expect(checklistLabel(x, SHEET), x).toBe(NORTH);
    expect(checklistLabel("Leadership: Theory and Practice by Peter Northouse, Ch. 4", "")).toBe("The assigned chapter: Chapter 4 of Peter Northouse, Leadership: Theory and Practice");
    expect(checklistLabel("Northouse, Leadership: Theory and Practice, pp. 45-70", "")).toBe("The assigned reading: pp. 45–70 of Northouse, Leadership: Theory and Practice");
    expect(checklistLabel("Northouse, Leadership: Theory and Practice, Chapter 4, pp. 45-70", "")).toBe("The assigned chapter: Chapter 4 (pp. 45–70) of Northouse, Leadership: Theory and Practice");
    expect(checklistLabel("Northouse, Leadership: Theory and Practice", "")).toBe("The assigned reading: Northouse, Leadership: Theory and Practice");
    expect(checklistLabel("HBR article 'What Makes a Leader?' by Daniel Goleman", SHEET)).toBe(GOLE);
  });
  it("idempotent: a pinned label pins to itself", () => {
    for (const x of [NORTH, GOLE, "The assigned reading: pp. 45–70 of Northouse, Leadership: Theory and Practice", "The assigned chapter: Chapter 4 (pp. 45–70) of Northouse, Leadership: Theory and Practice", "The assigned reading: Northouse, Leadership: Theory and Practice"]) expect(checklistLabel(x, "")).toBe(x);
  });
  it("not readings: untouched", () => {
    for (const x of ["APA 7 format", "1,200-1,500 words", "one real leader as your example", "Sam Walton, servant leadership", "APA 7, double spaced"]) expect(checklistLabel(x, "")).toBe(x);
  });
  it("the checklist builder is the choke point: raw parse items come out pinned", () => {
    const raw = ["Northouse, Leadership: Theory and Practice (Chapter 4)", "HBR article 'What Makes a Leader?' by Daniel Goleman", "APA 7 format"];
    const lines = requirementLines("Sam Walton. I like servant, not transformational, because he put associates first.", { leader: "Sam Walton", styles: ["servant"], mustInclude: raw, needsPerson: true });
    expect(lines).toContain(`○ ${NORTH}. I'll help you with this one.`);
    expect(lines).toContain(`○ ${GOLE}. I'll help you with this one.`);
    expect(lines).toContain("○ APA 7 format. We'll handle it when you draft.");
    const turn = informedAffirm("Sam Walton, servant leadership. I read both.", { leader: "Sam Walton", mustInclude: raw, needsPerson: true });
    expect(turn.filter((l) => /Northouse|Goleman/.test(l)).every((l) => /The assigned (?:chapter|article): /.test(l))).toBe(true);
    expect(readFileSync("lib/stage1/north-turns.ts", "utf8")).toContain('const item = checklistLabel(raw, "")');
  });
});

describe("QA prod smoke (after #83) 2: every required reading is in the skeleton; no look-alike titles", () => {
  const names = readingNames(SHEET);
  const readings = requiredReadings(SHEET, names);
  it("the required readings, by author", () => {
    expect(readings.sort()).toEqual(["Goleman", "Northouse"]);
    expect(requiredReadings("Use the Smith article. Jones's book is optional background.", ["Smith", "Jones"])).toEqual(["Smith"]);
  });
  it("f8df7ccc: Northouse's paragraph names Northouse; the two Walton titles no longer look alike", () => {
    const shape = shapeFromModel({ body: [{ focus: "Northouse style suited to change" }, { focus: "the leader's change story" }, { focus: "Goleman's emotional intelligence link" }, { focus: "counterargument and reply" }] }, names)!;
    const fit = coverReadings(fitBodies(shape, bodyPlan({ text: SHEET }), readings), readings);
    const outline: ShapeOutline = { v: 1, source: "model", shapeSig: shapeSigOf(fit), titles: ["Sam Walton, servant leadership, change fit", "Sam Walton, change story, associates first", "Goleman, emotional intelligence link", "Counterargument, reply to objection"].map((title, i) => ({ key: `body-${i + 1}`, title, ideaRefs: [] })) };
    const titles = varyTitles(fixTitles(projectSkeleton(fit, outline), readings, "Sam Walton"), "Sam Walton").blocks.filter((b) => b.group === "body").map((b) => b.title);
    expect(titles).toEqual(["Northouse, servant leadership, change fit", "Sam Walton, change story, associates first", "Goleman, emotional intelligence link", "Counterargument, reply to objection"]);
    for (const r of readings) expect(titles.some((t) => t?.includes(r))).toBe(true);
  });
  it("a reading the model left out is woven into a body, within the count", () => {
    const shape = shapeFromModel({ body: [{ focus: "the leader's change story" }, { focus: "servant leadership in action" }, { focus: "Goleman's emotional intelligence link" }, { focus: "evidence it worked" }, { focus: "counterargument and reply" }] }, names)!;
    const fit = coverReadings(fitBodies(shape, bodyPlan({ text: SHEET }), readings), readings);
    const subs = fit.blocks.filter((b) => b.group === "body").map((b) => b.sub);
    expect(subs).toHaveLength(4);
    expect(subs).toContain("Goleman's emotional intelligence link");
    expect(subs.some((x) => /Northouse/.test(x))).toBe(true);
    expect(subs.at(-1)).toBe("counterargument and reply");
    const outline: ShapeOutline = { v: 1, source: "model", shapeSig: shapeSigOf(fit), titles: ["Sam Walton, change story", "Sam Walton, servant leadership", "Goleman, emotional intelligence", "Counterargument and reply"].map((title, i) => ({ key: `body-${i + 1}`, title, ideaRefs: [] })) };
    const titles = fixTitles(projectSkeleton(fit, outline), readings, "Sam Walton").blocks.filter((b) => b.group === "body").map((b) => b.title);
    expect(titles.filter((t) => t?.includes("Northouse"))).toHaveLength(1);
  });
  it("trimming keeps the reading paragraphs", () => {
    const shape = shapeFromModel({ body: [{ focus: "the leader's change story" }, { focus: "servant leadership in action" }, { focus: "evidence it worked" }, { focus: "Northouse styles for change" }, { focus: "Goleman's emotional intelligence link" }, { focus: "counterargument and reply" }] }, names)!;
    const subs = fitBodies(shape, bodyPlan({ text: SHEET }), readings).blocks.filter((b) => b.group === "body").map((b) => b.sub);
    expect(subs).toEqual(["the leader's change story", "Northouse styles for change", "Goleman's emotional intelligence link", "counterargument and reply"]);
  });
  it("near-duplicates fall back: same opening, or mostly the same words", () => {
    const shape = shapeFromModel({ body: [{ focus: "servant leadership through change" }, { focus: "the leader's change story" }, { focus: "evidence it worked" }] })!;
    const outline: ShapeOutline = { v: 1, source: "model", shapeSig: shapeSigOf(shape), titles: ["Associates first, servant leadership", "Associates first, change story", "Servant leadership, associates first"].map((title, i) => ({ key: `body-${i + 1}`, title, ideaRefs: [] })) };
    const titles = fixTitles(projectSkeleton(shape, outline), [], "Sam Walton").blocks.filter((b) => b.group === "body").map((b) => b.title);
    expect(titles[0]).toBe("Associates first, servant leadership");
    expect(titles[1]).toBe("Change story");
    expect(titles[2]).toBe("Evidence it worked");
  });
  it("wired after the model: ensureShape covers readings; the view fixes titles", () => {
    const ghost = readFileSync("lib/server/skeleton/ghost.ts", "utf8");
    expect(ghost).toContain("coverReadings(fitBodies(await ensureShapeRaw(input), plan, readings), readings)");
    expect(ghost).toContain("varyTitles(fixTitles(projectSkeleton(shape, outline), extra.readings ?? [], extra.leader), extra.leader)");
    expect(readFileSync("app/api/papers/[paperId]/skeleton/route.ts", "utf8")).toContain("readings: requiredReadings(text, readingNames(text))");
  });
});
