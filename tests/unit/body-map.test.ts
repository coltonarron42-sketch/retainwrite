/** QA prod quick-lock (41e4b81, paper 13ccbcdb): Body notes land in the same paragraphs every time. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paperSections, placeBodyNotes, wordsForBlock } from "@/lib/skeleton/sections";

type B = { key: string; group: "intro" | "body" | "conclusion"; label: string; sub: string; title: string | null; ideaRefs: number[] };
const blk = (key: string, title: string | null, sub: string, ideaRefs: number[] = []): B => ({ key, group: "body", label: key, sub, title, ideaRefs });
// The prod paper's shape and titles (13ccbcdb).
const PROD = (refs: number[][] = [[], [], [], [], []]) => [
  blk("body-1", "Sam Walton, servant leadership", "northouse style for change", refs[0]),
  blk("body-2", "Sam Walton, transformational leadership", "goleman's emotional intelligence link", refs[1]),
  blk("body-3", "Sam Walton, the leader's change story", "the leader's change story", refs[2]),
  blk("body-4", "Sam Walton, style in the change episode", "style in action analysis", refs[3]),
  blk("body-5", "counterargument and reply", "counterargument and reply", refs[4]),
];
// The prod paper's two Body answers: the first names no style, the second names both.
const NOTES = [
  "Walton visited stores, listened to associates and shared profits with them, and that kept people bought in while Walmart kept expanding.",
  "Walton asked associates what they needed on the floor and then acted on it, which is the servant side, while his big vision for growth is the transformational side.",
];
const SERVANT = "His servant side: he listened on store visits.";
const TRANS = "His transformational side: he sold the growth vision.";

describe("placeBodyNotes", () => {
  it("the prod answers land in Body 1 and 2 (the paragraphs titled from their styles), as on the preview", () => {
    expect(placeBodyNotes(PROD(), NOTES)).toMatchObject({ "body-1": [0], "body-2": [1], "body-3": [], "body-4": [], "body-5": [] });
  });
  it("a note naming one style goes to that style's paragraph, whatever the order", () => {
    expect(placeBodyNotes(PROD(), [TRANS, SERVANT])).toMatchObject({ "body-1": [1], "body-2": [0] });
  });
  it("the same even when the model placed them in Body 3 and 4 (the prod run): the style rule wins", () => {
    expect(placeBodyNotes(PROD([[], [], [0], [1], []]), NOTES)).toMatchObject({ "body-1": [0], "body-2": [1], "body-3": [], "body-4": [] });
  });
  it("deterministic: every model run gives the same placement for style notes", () => {
    const runs = [[[], [], [0], [1], []], [[0], [1], [], [], []], [[1], [0], [], [], []], [[], [], [], [], [0, 1]]].map((r) => placeBodyNotes(PROD(r), NOTES));
    for (const r of runs) expect(r).toEqual(runs[0]);
  });
  it("more notes: the style paragraphs fill first, then the other empty paragraphs in order", () => {
    const notes = [...NOTES, "He cut prices and visited every store himself.", "Critics say it squeezed suppliers."];
    expect(placeBodyNotes(PROD([[], [], [3], [2], []]), notes)).toMatchObject({ "body-1": [0], "body-2": [1], "body-3": [2], "body-4": [3], "body-5": [] });
  });
  it("no style titles (other subjects): the model's placement still applies", () => {
    const blocks = [blk("b1", "Climate policy, carbon tax", "a"), blk("b2", "Climate policy, cap and trade", "b", [0])];
    expect(placeBodyNotes(blocks, ["cap and trade note", "tax note"])).toEqual({ b1: [1], b2: [0] });
  });
  it("a note never shows twice and is never dropped", () => {
    const notes = [...NOTES, "x one", "x two", "x three", "x four", "x five"];
    const placed = placeBodyNotes(PROD([[2, 3], [2], [3], [4], [5]]), notes);
    const all = Object.values(placed).flat().sort((a, b) => a - b);
    expect(all).toEqual(notes.map((_, j) => j));
  });
  it("no titles yet: the old order rule (note 1 in Body 1, extras in the last)", () => {
    const blocks = [blk("b1", null, "a"), blk("b2", null, "b")];
    expect(placeBodyNotes(blocks, ["n1", "servant n2", "n3"])).toEqual({ b1: [0], b2: [1, 2] });
  });
});

describe("the skeleton shows them there", () => {
  it("wordsForBlock / paperSections: Body Paragraph 1 and 2 hold the servant and transformational answers", () => {
    const body = PROD([[], [], [0], [1], []]);
    const words = { body: { locked: true, notes: NOTES } };
    expect(wordsForBlock(body[0]!, body, words)).toEqual([NOTES[0]]);
    expect(wordsForBlock(body[2]!, body, words)).toEqual([]);
    const secs = paperSections({ view: { blocks: body, transitions: [], source: "model" }, words });
    expect(secs.filter((s) => s.completed).map((s) => s.kicker)).toEqual(["Body Paragraph 1", "Body Paragraph 2"]);
  });
  it("the model is shown the titles on screen, not only the private focus lines", () => {
    const src = readFileSync("lib/server/skeleton/ghost.ts", "utf8");
    expect(src).toMatch(/shownTitle \? `\$\{shownTitle\} \(\$\{b\.sub\}\)` : b\.sub/);
  });
});
