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
    foldLines(recs, [{ el: a, who: "pau", text: "○ Decision made" }, { el: b, who: "you", text: "ok" }, { el: c, who: "you", text: "ok" }], (x) => attached.has(x));
    expect(recs.map((r) => r.text)).toEqual(["○ Decision made", "ok", "ok"]);
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
  it("the newest line drawn again by a second bubble is not a second turn", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a"), b = el("b");
    foldLines(recs, [{ el: a, who: "pau", text: "Stage 1 is about this." }], () => true, 0);
    foldLines(recs, [], () => false, 3000);
    foldLines(recs, [{ el: b, who: "pau", text: "Stage 1 is about this." }], (x) => x === b, 9000);
    expect(linesOf(recs)).toHaveLength(1);
  });
  it("a checklist remounting with a new tick stays one line", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a"), b = el("b");
    const head = "Stage 1 is about getting clear on what the assignment really asks. ";
    foldLines(recs, [{ el: a, who: "pau", text: head + "○ Decision made" }], (x) => x === a, 0);
    foldLines(recs, [{ el: b, who: "pau", text: head + "✓ Decision made" }], (x) => x === b, 9000);
    expect(linesOf(recs).map((l) => l.text)).toEqual([head + "✓ Decision made"]);
  });
  it("a bubble that flashes another line and settles back is still one line", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a");
    const X = "Stage 1 is about getting clear. Okay, a few quick questions.";
    foldLines(recs, [{ el: a, who: "pau", text: X }], () => true, 0);
    foldLines(recs, [{ el: a, who: "pau", text: "Okay, a few quick questions." }], () => true, 5000);
    foldLines(recs, [{ el: a, who: "pau", text: X }], () => true, 5300);
    expect(linesOf(recs).map((l) => l.text)).toEqual([X]);
  });
  it("a bubble reused for the next question while its checklist remounts: checklist stays one line, order follows the screen", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a"), b = el("b"), c = el("c");
    const head = "Stage 1 is about getting clear on what the assignment really asks. ";
    foldLines(recs, [{ el: a, who: "pau", text: head + "○ Read it ○ Decide" }], (x) => x === a, 0);
    const att = new Set<Element>([a, b, c]);
    foldLines(recs, [{ el: b, who: "pau", text: head + "✓ Read it ○ Decide" }, { el: c, who: "you", text: "I've read it" }, { el: a, who: "pau", text: "Which leadership style do you want to argue?" }], (x) => att.has(x), 7000);
    expect(linesOf(recs).map((l) => l.text)).toEqual([head + "✓ Read it ○ Decide", "I've read it", "Which leadership style do you want to argue?"]);
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

import { singleNamedLeader } from "@/lib/stage1/single-name";
import { parseStance } from "@/lib/stage1/paper-context";
import { namedPerson } from "@/lib/stage1/north-turns";
describe("Round 4 QA: a leader named with one word is recognized", () => {
  it("finds Walton, not the style or a company", () => {
    expect(singleNamedLeader("I'd pick Servant because Walton put associates first, and that kept people with him during growth and change.")).toBe("Walton");
    expect(singleNamedLeader("Transformational, because Nadella's vision got people to want the change.")).toBe("Nadella");
    expect(singleNamedLeader("I'd pick Situational because Microsoft changed fast.")).toBeNull();
    expect(singleNamedLeader("Servant works best because people stay.")).toBeNull();
    expect(singleNamedLeader("Walton put people first.")).toBeNull(); // first word: too risky to call a name
    expect(namedPerson("I'd pick Servant because Walton put associates first")).toBe("Walton");
  });
  it("parseStance carries the one-word leader", () => {
    const r = parseStance("I'd pick Servant because Walton put associates first, and that kept people with him during growth and change.", [{ label: "Servant", why: "x" }] as never, [{ label: "Satya Nadella", why: "y" }] as never);
    expect(r?.leader).toBe("Walton");
  });
});

import { relate } from "@/lib/chat/turn-recorder";
describe("QA 11:08: Past chat never merges a checklist with the next ask", () => {
  const el = (n: string) => ({ n }) as unknown as Element;
  const lead = "Awesome, sounds like you have a good idea.\n✓ A real leader: Walton.\n○ Your case";
  it("relate reads ticks and typing as the same turn, a new ask as new", () => {
    expect(relate(lead, lead.replace("○", "✓")).grow).toBe(true);
    expect(relate("Hel", "Hello there").grow).toBe(true);
    expect(relate(lead + "\nWhich one?", lead + "\nSay a bit more about why that one.")).toEqual({ grow: false, k: 3 });
  });
  it("the same bubble moving from one ask to the next records the new ask alone, once", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a"), b = el("b");
    foldLines(recs, [{ el: a, who: "pau", text: lead + "\nWhat's your main reason?" }], () => true, 0);
    foldLines(recs, [{ el: a, who: "pau", text: lead + "\nSay a bit more about why that one." }], () => true, 5000);
    // then the ask shows on its own in a fresh bubble
    foldLines(recs, [{ el: b, who: "pau", text: "Say a bit more about why that one." }], (x) => x === b, 6000);
    expect(linesOf(recs).map((l) => l.text)).toEqual([lead + "\nWhat's your main reason?", "Say a bit more about why that one."]);
  });
  it("a bubble that drops its ask keeps the full line", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const a = el("a");
    foldLines(recs, [{ el: a, who: "pau", text: lead + "\nWhich one?" }], () => true, 0);
    foldLines(recs, [{ el: a, who: "pau", text: lead }], () => true, 5000);
    expect(linesOf(recs).map((l) => l.text)).toEqual([lead + "\nWhich one?"]);
  });
});

import { isFillerSaying, withoutFiller, stylesIn, pickEscalation } from "@/lib/stage1/north-turns";
describe("QA 11:08 Stage 1 text fixes", () => {
  it("filler runs and empty reasons are filler, and never reach the stored take", () => {
    expect(isFillerSaying("second quick message")).toBe(true);
    expect(isFillerSaying("because it's good")).toBe(true);
    expect(isFillerSaying("Servant, because people stay")).toBe(false);
    expect(withoutFiller("because it's good When Walmart grew fast, Walton listened to associates.")).toBe("When Walmart grew fast, Walton listened to associates.");
  });
  it("a style named on its own is kept for the checklist", () => {
    expect(stylesIn("I'd pick Servant because Walton put associates first")).toEqual(["servant"]);
  });
  it("a plain 'make this easier' asks one thing", () => {
    const opts = [{ label: "Transformational", why: "vision" }, { label: "Servant", why: "people first" }] as never;
    const e = pickEscalation({ options: opts, round: 2, people: [{ label: "Satya Nadella", why: "x" }] as never, catchUpSkipped: true });
    const t = e.paras.join("\n");
    expect((t.match(/\?/g) ?? []).length).toBe(1);
    expect(t).not.toMatch(/Leaders people often write about|catch you up/);
  });
});

describe("QA 11:21: in-between plan items are never rendered or spoken", () => {
  it("hides the style question while an informed answer's decision is saving", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain('{q && !(decisionSaving && q.id === "decision_pick") ? (');
    expect(src).toContain('const currentTurnTexts: string[] = q && !(decisionSaving && q.id === "decision_pick")');
    expect(src).toMatch(/setDecisionSaving\(true\)[\s\S]{0,400}setDecisionSaving\(false\)/);
  });
});

describe("QA 11:26: an in-between Pau bubble is never a Past chat line", () => {
  it("drops a Pau bubble that vanishes within the flash window and never comes back", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const [ans, flash, next] = [{}, {}, {}] as unknown as Element[];
    const attached = new Set<Element>([ans!, flash!]);
    foldLines(recs, [{ el: ans!, who: "you", text: "I'd pick Servant because Walton put associates first" }, { el: flash!, who: "pau", text: "Which direction do you want to take your paper?" }], (x) => attached.has(x), 10_000);
    attached.delete(flash!);
    attached.add(next!);
    foldLines(recs, [{ el: ans!, who: "you", text: "I'd pick Servant because Walton put associates first" }, { el: next!, who: "pau", text: "Next up: the stance interview." }], (x) => attached.has(x), 11_000);
    expect(linesOf(recs).map((l) => l.text)).toEqual(["I'd pick Servant because Walton put associates first", "Next up: the stance interview."]);
  });
  it("keeps a Pau turn that stayed on screen, and one that remounts", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const [q, q2, n] = [{}, {}, {}] as unknown as Element[];
    const attached = new Set<Element>([q!]);
    foldLines(recs, [{ el: q!, who: "pau", text: "Where are you with it?" }], (x) => attached.has(x), 0);
    attached.delete(q!);
    attached.add(q2!);
    foldLines(recs, [{ el: q2!, who: "pau", text: "Where are you with it?" }], (x) => attached.has(x), 500);
    attached.delete(q2!);
    attached.add(n!);
    foldLines(recs, [{ el: n!, who: "pau", text: "Next one?" }], (x) => attached.has(x), 9_000);
    expect(linesOf(recs).map((l) => l.text)).toEqual(["Where are you with it?", "Next one?"]);
  });
  it("hides the old 'Which direction…?' turn when the angle came from their decision", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toMatch(/setStoryAngle\(\{ text: decided, source: "student" \}\);\s*setStoryFromDecision\(true\)/);
    expect(src).toContain("{storyAngle && screen !== \"story\" && !storyFromDecision &&");
  });
});

import { stage2Earlier } from "@/lib/stages/stage2-intro";
describe("QA 11:26: the Stage 2 recap keeps Walton after the voice merge", () => {
  it("reads 'Earlier you picked Servant and Transformational with Sam Walton…'", () => {
    const answer = "I'd pick Servant and Transformational because Sam Walton put associates first, and that kept people with him during growth and change.";
    const opts = [{ label: "Servant", why: "x" }, { label: "Transformational", why: "y" }] as never;
    const p = parseStance(answer, opts, [] as never);
    expect(p?.leader).toMatch(/Walton/);
    const s = stage2Earlier({ question: "q", pick: "Servant", answer, at: 1 } as never, { pick: p!.leader! } as never, opts);
    expect(s).toMatch(/^Earlier you picked Servant and Transformational with Sam Walton as your example, because/);
  });
});

describe("QA 11:08 must-fix (live): the decline is never a reading question", () => {
  it("an answered summary offer skips the aside, skip and lookup readings", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("if (typed && !offerAnswered && isSkipSaying(typed)) {");
    expect(src).toMatch(/text &&\s*!offerAnswered &&\s*brief\?\.northstar &&\s*q\.id !== "stance_early"/);
  });
});

describe("QA 11:26: quick answers and lead-in redraws keep Past chat in order", () => {
  it("a question answered within the flash window stays before the answer; its redraw without the lead-in is the same line", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const [q, a, q2, a2, n] = [{}, {}, {}, {}, {}] as unknown as Element[];
    const att = new Set<Element>([q!]);
    const on = (x: Element) => att.has(x);
    foldLines(recs, [{ el: q!, who: "pau", text: "Last one before the stance interview.\nWhat's your early take on which style works best?" }], on, 1_000);
    att.add(a!);
    foldLines(recs, [{ el: q!, who: "pau", text: "Last one before the stance interview.\nWhat's your early take on which style works best?" }, { el: a!, who: "you", text: "I think transformational works best" }], on, 1_500);
    att.delete(q!); att.delete(a!); att.add(q2!); att.add(a2!);
    foldLines(recs, [{ el: q2!, who: "pau", text: "What's your early take on which style works best?" }, { el: a2!, who: "you", text: "I think transformational works best" }], on, 2_000);
    att.add(n!);
    foldLines(recs, [{ el: q2!, who: "pau", text: "What's your early take on which style works best?" }, { el: a2!, who: "you", text: "I think transformational works best" }, { el: n!, who: "pau", text: "I pulled together a couple of places to start looking." }], on, 6_000);
    expect(linesOf(recs).map((l) => l.text.split("\n").at(-1))).toEqual([
      "What's your early take on which style works best?",
      "I think transformational works best",
      "I pulled together a couple of places to start looking.",
    ]);
  });
});

describe("QA 11:26: a quickly answered question is not overwritten by the next ask in the same bubble", () => {
  it("keeps Q, answer, next ask in order", () => {
    const recs: Parameters<typeof foldLines>[0] = [];
    const [g, a, h] = [{}, {}, {}] as unknown as Element[];
    const att = new Set<Element>([g!]);
    const on = (x: Element) => att.has(x);
    foldLines(recs, [{ el: g!, who: "pau", text: "Which leadership style do you want to argue works best here?" }], on, 1_000);
    att.add(a!);
    foldLines(recs, [{ el: g!, who: "pau", text: "Which leadership style do you want to argue works best here?" }, { el: a!, who: "you", text: "I'd pick Servant because Walton put associates first" }], on, 1_300);
    foldLines(recs, [{ el: a!, who: "you", text: "I'd pick Servant because Walton put associates first" }, { el: g!, who: "pau", text: "What's your main reason for that pick?" }], on, 1_600);
    att.add(h!);
    foldLines(recs, [{ el: h!, who: "pau", text: "Which leadership style do you want to argue works best here?" }, { el: a!, who: "you", text: "I'd pick Servant because Walton put associates first" }, { el: g!, who: "pau", text: "What's your main reason for that pick?" }], on, 1_900);
    expect(linesOf(recs).map((l) => l.text)).toEqual([
      "Which leadership style do you want to argue works best here?",
      "I'd pick Servant because Walton put associates first",
      "What's your main reason for that pick?",
    ]);
  });
});
