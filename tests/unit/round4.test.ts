import { describe, expect, it } from "vitest";
import { isSolidReason, moreWordsNote } from "@/lib/stage1/chat-copy";

describe("Round 4 #2: a solid reason is accepted, nudges ask one thing", () => {
  it("recognises a solid reason without the word 'because'", () => {
    expect(isSolidReason("Servant leadership works best for change, it builds trust so people stick with the plan.")).toBe(true);
    expect(isSolidReason("Transformational leadership, since Nadella gave the whole company a reason to want the change.")).toBe(true);
    expect(isSolidReason("transformational")).toBe(false);
  });
  it("a nudge is never two questions, and never asks for 'the why' when they gave one", () => {
    for (let i = 0; i < 4; i++) {
      const n = moreWordsNote(14, 25, "Your early take", "I think servant leadership works best because it builds trust in a team.", i);
      expect((n.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
      expect(n).not.toMatch(/Now the why/);
    }
    expect((moreWordsNote(3, 25, "Your early take", "servant leadership", 0).match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});

import { foldLines, linesOf, sameTurn, seedLines } from "@/lib/chat/turn-recorder";
describe("Round 4 #3: Past chat records turns as they render", () => {
  const el = (n: string) => ({ n }) as unknown as Element;
  it("records each bubble once, in order, keeps separate replies separate, and follows a ticking checklist", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a"), b = el("b"), c = el("c"), d = el("d");
    const attached = new Set<Element>([a, b, c]);
    foldLines(recs, [{ el: a, who: "pau", text: "Q1?" }, { el: b, who: "you", text: "ok" }, { el: c, who: "you", text: "ok" }], (x) => attached.has(x));
    expect(recs.map((r) => r.text)).toEqual(["Q1?", "ok", "ok"]);
    foldLines(recs, [{ el: a, who: "pau", text: "○ Decision made → ✓ Decision made" }], (x) => attached.has(x));
    expect(recs[0]!.text).toMatch(/✓ Decision made/);
    // b re-rendered as d (same words, old bubble gone): mapped, not added.
    attached.delete(b); attached.add(d);
    foldLines(recs, [{ el: d, who: "you", text: "ok" }], (x) => attached.has(x));
    expect(recs).toHaveLength(3);
  });
  it("a bubble reused for a new turn starts a new line; a flash replaced at once does not; the same words sent again later are new", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a"), b = el("b"), c = el("c");
    const att = new Set<Element>([a, b]);
    foldLines(recs, [{ el: a, who: "pau", text: "Okay, a few quick questions." }], (x) => att.has(x), 0);
    foldLines(recs, [{ el: a, who: "pau", text: "Stage 1 is about getting clear on the assignment." }], (x) => att.has(x), 500);
    expect(linesOf(recs).map((l) => l.text)).toEqual(["Stage 1 is about getting clear on the assignment."]);
    foldLines(recs, [{ el: a, who: "pau", text: "Stage 1 is about getting clear on the assignment. ✓ Decision made" }], (x) => att.has(x), 60000);
    expect(linesOf(recs)).toHaveLength(1);
    foldLines(recs, [{ el: b, who: "you", text: "first quick message" }], (x) => att.has(x), 61000);
    foldLines(recs, [{ el: a, who: "pau", text: "No worries, take your time." }], (x) => att.has(x), 63000);
    expect(linesOf(recs).map((l) => l.text)).toEqual(["Stage 1 is about getting clear on the assignment. ✓ Decision made", "first quick message", "No worries, take your time."]);
    att.delete(b); att.add(c);
    foldLines(recs, [{ el: c, who: "you", text: "first quick message" }], (x) => att.has(x), 64000);
    expect(linesOf(recs)).toHaveLength(3);
    att.delete(c);
    foldLines(recs, [], (x) => att.has(x), 65000);
    const d = el("d"); att.add(d);
    foldLines(recs, [{ el: d, who: "you", text: "first quick message" }], (x) => att.has(x), 80000);
    expect(linesOf(recs)).toHaveLength(4);
    expect(sameTurn("Give me a little more. What happened?", "Closer. What happened next?")).toBe(false);
  });
  it("after a reload, history the screen re-renders is not added again", () => {
    const x = el("x"), y = el("y");
    const out = seedLines([{ who: "pau", text: "Hi" }], [{ who: "pau", text: "Next up is the change part.", el: y }, { who: "pau", text: "Hi", el: x }]);
    expect(linesOf(out).map((l) => l.text)).toEqual(["Hi"]);
    const z = el("z");
    foldLines(out, [{ el: z, who: "pau", text: "Restored ask" }], () => true, 100, true);
    foldLines(out, [{ el: z, who: "pau", text: "A brand new reply after the reload" }], () => true, 9000, false);
    expect(linesOf(out).map((l) => l.text)).toEqual(["Hi", "A brand new reply after the reload"]);
  });
  it("a reload maps the bubbles on screen onto the saved lines", () => {
    const x = el("x"), y = el("y");
    const out = seedLines([{ who: "pau", text: "Hi" }, { who: "you", text: "BUS 210" }], [{ who: "you", text: "BUS 210", el: x }, { who: "pau", text: "Give me a little more. What happened?", el: y }]);
    expect(linesOf(out).map((r) => r.text)).toEqual(["Hi", "BUS 210"]);
  });
});
