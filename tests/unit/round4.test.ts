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

import { foldLines, seedLines } from "@/lib/chat/turn-recorder";
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
  it("a reload maps the bubbles on screen onto the saved lines and adds only new ones", () => {
    const x = el("x"), y = el("y");
    const out = seedLines([{ who: "pau", text: "Hi" }, { who: "you", text: "BUS 210" }], [{ who: "you", text: "BUS 210", el: x }, { who: "pau", text: "Give me a little more. What happened?", el: y }]);
    expect(out.map((r) => r.text)).toEqual(["Hi", "BUS 210", "Give me a little more. What happened?"]);
  });
});
