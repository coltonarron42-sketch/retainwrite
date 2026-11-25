import { describe, expect, it } from "vitest";
import { projectSkeleton, ruleShape, type SkeletonView } from "@/lib/skeleton/shape";
import { needsTitlePage, paperSections, previewText, sectionHref, sectionTarget, skeletonWordsFromSession } from "@/lib/skeleton/sections";
import { HOLD_MS, IDLE, pressReduce, type PressEvent, type PressState } from "@/lib/skeleton/long-press";

const viewFor = (words: number): SkeletonView => projectSkeleton(ruleShape({ text: "Explain which leadership style works best.", words }), null);
const session = (over: Partial<Record<"intro" | "body" | "conclusion", { status?: string; ideas?: string[] }>> = {}) =>
  (["intro", "body", "conclusion"] as const).map((k) => ({ key: k, kind: k, status: over[k]?.status ?? "open", ideas: over[k]?.ideas ?? [] }));

describe("PC-30 Skeleton sections: order and count", () => {
  it("is Introduction, Body Paragraph 1..N, Conclusion, with N from the paper's length", () => {
    const short = paperSections({ view: viewFor(800), words: {} });
    expect(short.map((s) => s.title)).toEqual(["Introduction", "Body Paragraph 1", "Body Paragraph 2", "Conclusion"]);
    const long = paperSections({ view: viewFor(2000), words: {} });
    expect(long.filter((s) => s.group === "body")).toHaveLength(7);
    expect(long[0]!.title).toBe("Introduction");
    expect(long.at(-1)!.title).toBe("Conclusion");
    expect(long.filter((s) => s.group === "body").map((s) => s.title)).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `Body Paragraph ${n}`));
  });
  it("puts a title page first only when the assignment asks for one", () => {
    expect(paperSections({ view: viewFor(800), words: {}, titlePage: true })[0]).toMatchObject({ id: "title", title: "Title Page", completed: false, sectionKey: null });
    expect(needsTitlePage({ formattingRules: ["Include a title page"] })).toBe(true);
    expect(needsTitlePage({ citationStyle: "apa" })).toBe(true);
    expect(needsTitlePage({ citationStyle: "mla" })).toBe(false);
    expect(needsTitlePage({ text: "No title page needed.", citationStyle: "apa" })).toBe(false);
    expect(needsTitlePage({})).toBe(false);
  });
  it("is empty while there's no shape yet (the building state shows instead)", () => {
    expect(paperSections({ view: null, words: {} })).toEqual([]);
  });
});

describe("PC-30 Skeleton sections: status and content", () => {
  it("a section is done only when locked AND it has the student's own words", () => {
    const words = skeletonWordsFromSession(
      session({ intro: { status: "confirmed", ideas: ["Walton put associates first."] }, body: { status: "open", ideas: ["n1", "n2"] }, conclusion: { status: "confirmed", ideas: [] } }),
    );
    const rows = paperSections({ view: viewFor(800), words });
    expect(rows.find((r) => r.group === "intro")).toMatchObject({ completed: true, preview: ["Walton put associates first."] });
    // Notes but not locked: title only.
    expect(rows.filter((r) => r.group === "body").every((r) => !r.completed && r.preview.length === 0)).toBe(true);
    // Locked but no words: title only.
    expect(rows.find((r) => r.group === "conclusion")).toMatchObject({ completed: false, preview: [] });
  });
  it("Stage 3 outlined sections count as done and body notes spread over the body paragraphs", () => {
    const words = skeletonWordsFromSession(session({ body: { ideas: ["first point", "second point", "third point"] } }), ["body"]);
    const body = paperSections({ view: viewFor(800), words }).filter((r) => r.group === "body");
    expect(body.map((b) => b.preview)).toEqual([["first point"], ["second point", "third point"]]);
    expect(body.every((b) => b.completed && b.sectionKey === "body")).toBe(true);
  });
  it("uses ghost #2's idea refs when there are some, and never shows ghost text", () => {
    const v = viewFor(800);
    v.blocks[1]!.ideaRefs = [1];
    v.blocks[1]!.title = "Sam Walton, servant leadership";
    const words = skeletonWordsFromSession(session({ body: { status: "confirmed", ideas: ["a", "b"] } }));
    const rows = paperSections({ view: v, words });
    expect(rows[1]).toMatchObject({ title: "Body Paragraph 1", preview: ["b"] });
    expect(JSON.stringify(rows)).not.toContain("Sam Walton, servant");
  });
  it("blank notes are dropped", () => {
    const words = skeletonWordsFromSession(session({ intro: { status: "confirmed", ideas: ["  ", ""] } }));
    expect(paperSections({ view: viewFor(800), words })[0]!.completed).toBe(false);
  });
  it("previews cut on a word, never mid-word", () => {
    const t = previewText(["word ".repeat(200)], 50);
    expect(t.endsWith("word…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(51);
  });
});

describe("PC-30 open a section: where it's worked on now", () => {
  const body = { sectionKey: "body" };
  it("nothing opens in Stage 1; Stage 2 opens Stance; later the Stage 3 outline", () => {
    expect(sectionTarget(1, body)).toBeNull();
    expect(sectionTarget(2, body)).toEqual({ stage: 2, section: "body" });
    expect(sectionTarget(3, body)).toEqual({ stage: 3, section: "body" });
    expect(sectionTarget(5, body)).toEqual({ stage: 3, section: "body" });
    expect(sectionTarget(3, { sectionKey: null })).toBeNull();
    expect(sectionHref("p1", { stage: 2, section: "body" })).toBe("/app/papers/p1/stage/2?section=body");
  });
});

describe("PC-30 long press", () => {
  const run = (events: PressEvent[]) => {
    let s: PressState = IDLE;
    const opened: string[] = [];
    const phases: string[] = [];
    for (const e of events) {
      const r = pressReduce(s, e);
      s = r.state;
      phases.push(s.phase);
      if (r.open) opened.push(r.open);
    }
    return { s, opened, phases };
  };
  it("a quick tap does not open", () => {
    expect(run([{ type: "down", id: "b1", x: 10, y: 10, t: 0 }, { type: "up", t: 120 }]).opened).toEqual([]);
  });
  it("hold lifts, release opens", () => {
    const r = run([{ type: "down", id: "b1", x: 10, y: 10, t: 0 }, { type: "tick", t: HOLD_MS }, { type: "up", t: HOLD_MS + 200 }]);
    expect(r.phases).toEqual(["pressing", "lifted", "idle"]);
    expect(r.opened).toEqual(["b1"]);
  });
  it("an early tick does not lift", () => {
    expect(run([{ type: "down", id: "b1", x: 0, y: 0, t: 0 }, { type: "tick", t: HOLD_MS - 50 }]).s.phase).toBe("pressing");
  });
  it("moving past the threshold (a scroll) cancels, even after the lift", () => {
    expect(run([{ type: "down", id: "b1", x: 0, y: 0, t: 0 }, { type: "move", x: 0, y: 30 }, { type: "tick", t: 500 }, { type: "up", t: 600 }]).opened).toEqual([]);
    expect(run([{ type: "down", id: "b1", x: 0, y: 0, t: 0 }, { type: "tick", t: 400 }, { type: "move", x: 15, y: 0 }, { type: "up", t: 600 }]).opened).toEqual([]);
  });
  it("small jitter stays a press", () => {
    expect(run([{ type: "down", id: "b1", x: 0, y: 0, t: 0 }, { type: "move", x: 3, y: 4 }, { type: "tick", t: 400 }, { type: "up", t: 500 }]).opened).toEqual(["b1"]);
  });
  it("pointercancel cancels", () => {
    expect(run([{ type: "down", id: "b1", x: 0, y: 0, t: 0 }, { type: "tick", t: 400 }, { type: "cancel" }, { type: "up", t: 500 }]).opened).toEqual([]);
  });
  it("a late timer still counts the hold on release", () => {
    expect(run([{ type: "down", id: "b2", x: 0, y: 0, t: 0 }, { type: "up", t: HOLD_MS + 10 }]).opened).toEqual(["b2"]);
  });
});

describe("PC-30 a note shows in one card only", () => {
  it("two paragraphs pointing at the same note: the first one keeps it", () => {
    const v = viewFor(1300);
    const body = v.blocks.filter((b) => b.group === "body");
    body[0]!.ideaRefs = [0];
    body[3]!.ideaRefs = [0, 1];
    const words = skeletonWordsFromSession(session({ body: { status: "confirmed", ideas: ["listen to the team", "second"] } }));
    const rows = paperSections({ view: v, words }).filter((r) => r.group === "body");
    expect(rows[0]!.preview).toEqual(["listen to the team"]);
    expect(rows[3]!.preview).toEqual(["second"]);
  });
});
