import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { asOnSheet, checklistLabel, readingFields } from "@/lib/stage1/lock-in";
import { requirementLines } from "@/lib/stage1/north-turns";
import { lowerTitle, readingNames, restoreNames } from "@/lib/copy/name-case";
import { shapeFromModel, withNameCase } from "@/lib/skeleton/shape";
import { sourceHintLead } from "@/lib/coaching/source-hints";

const SHEET = "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
const LABEL = "The assigned HBR article 'What Makes a Leader?' by Daniel Goleman";

describe("QA c09238f7: the checklist reading label is built from its fields", () => {
  it("every wording the parse gives lands on the same label (possessive included)", () => {
    for (const item of [
      "Daniel Goleman’s HBR article ‘What Makes a Leader?’",
      "Daniel Goleman's HBR article 'What Makes a Leader?'",
      "HBR article 'What Makes a Leader?' by Daniel Goleman",
      "assigned HBR article 'What Makes a Leader?' by Daniel Goleman",
      "The assigned HBR article 'What Makes a Leader?' by Daniel Goleman",
      "the HBR article “What Makes a Leader?” by Daniel Goleman.",
    ]) expect(checklistLabel(item, SHEET)).toBe(LABEL);
    expect(readingFields("Daniel Goleman’s HBR article ‘What Makes a Leader?’")).toEqual({ type: "HBR article", title: "What Makes a Leader?", author: "Daniel Goleman", chapter: null });
  });
  it("missing fields: graceful, and 'The assigned' is never dropped", () => {
    expect(checklistLabel("Goleman's article", "")).toBe("The assigned article by Goleman");
    expect(checklistLabel("the handout “Notes on the Quiet Kitchen”", "")).toBe("The assigned handout 'Notes on the Quiet Kitchen'");
    expect(checklistLabel("'What Makes a Leader?' by Daniel Goleman", "")).toBe("The assigned reading 'What Makes a Leader?' by Daniel Goleman");
    expect(checklistLabel("the assigned reading", "")).toBe("The assigned reading");
    expect(checklistLabel("Chapter 4 of Northouse, Leadership: Theory and Practice", SHEET)).toBe("The assigned chapter 4 of 'Leadership: Theory and Practice' by Northouse");
    expect(checklistLabel("Chapter 6 of Myers' Psychology (memory)", "")).toBe("The assigned chapter 6 of 'Psychology' by Myers");
  });
  it("not a reading: lock-in's existing rule (asOnSheet) is untouched", () => {
    for (const x of ["APA 7 format", "1,200-1,500 words", "one real leader as your example"]) expect(checklistLabel(x, SHEET)).toBe(asOnSheet(x, SHEET));
  });
  it("the checklist line keeps the label, and the read-status rule still works", () => {
    const must = ["Daniel Goleman’s HBR article ‘What Makes a Leader?’", "APA 7 format"].map((x) => checklistLabel(x, SHEET));
    const lines = requirementLines("I want to argue servant leadership with Sam Walton.", { leader: "Sam Walton", styles: ["servant"], mustInclude: must });
    expect(lines).toContain(`○ ${LABEL}. I'll help you with this one.`);
    const read = requirementLines("I read Goleman. Servant leadership with Sam Walton.", { leader: "Sam Walton", styles: ["servant"], mustInclude: must });
    expect(read).toContain(`✓ ${LABEL}: you've read it.`);
  });
  it("the intake labels checklist items with checklistLabel", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src.match(/\.map\(\(x\) => checklistLabel\(x, rawText\)\)/g)).toHaveLength(2);
  });
});

describe("QA: reading names keep their capitals in Body hints and skeleton lines", () => {
  const names = readingNames(SHEET);
  it("names come from the readings the sheet gives", () => {
    expect(names).toEqual(expect.arrayContaining(["Northouse", "Daniel", "Goleman", "HBR"]));
    expect(names).not.toContain("Using");
    expect(names).not.toContain("Leadership");
  });
  it("the model's focus line: 'Tie it to Northouse's styles', never 'northouse's'", () => {
    const raw = { body: [{ focus: "the leader's change story" }, { focus: "tie it to northouse's styles" }, { focus: "Goleman's emotional intelligence link" }, { focus: "Counterargument and reply" }] };
    const subs = shapeFromModel(raw, names)!.blocks.filter((b) => b.group === "body").map((b) => b.sub);
    expect(subs).toEqual(["the leader's change story", "tie it to Northouse's styles", "Goleman's emotional intelligence link", "counterargument and reply"]);
  });
  it("a stored shape (already lowercased) is served with the names fixed", () => {
    const stored = shapeFromModel({ body: [{ focus: "tie it to northouse's styles" }, { focus: "hbr article link" }] })!;
    expect(stored.blocks[1]!.sub).toBe("tie it to northouse's styles");
    const fixed = withNameCase(stored, names);
    expect(fixed.blocks.filter((b) => b.group === "body").map((b) => b.sub)).toEqual(["tie it to Northouse's styles", "HBR article link"]);
  });
  it("Body hints put a title mid-sentence without lowercasing names", () => {
    expect(lowerTitle("Tie it to Northouse's styles")).toBe("tie it to Northouse's styles");
    expect(lowerTitle("Body Paragraph 5")).toBe("body paragraph 5");
    expect(lowerTitle("Sam Walton, servant")).toBe("Sam Walton, servant");
    expect(lowerTitle("Introduction")).toBe("introduction");
    expect(lowerTitle("Goleman's emotional intelligence link")).toBe("Goleman's emotional intelligence link");
    expect(sourceHintLead(2, "Tie it to Northouse's styles")).toBe("Here's the source if you want to refresh before writing your tie it to Northouse's styles. This is the section to reference it in.");
    expect(restoreNames("goleman and northouse", names)).toBe("Goleman and Northouse");
  });
});
