/**
 * PC-29 follow-ups (QA after #65): the Stage 2 recap keeps the informed pick and leader even when
 * the early take has no "because"; her word-for-word on-screen prompt never lingers as a voice
 * transcript bubble (e.g. under "Start stance interview").
 */
import { describe, expect, it } from "vitest";
import { stage2Earlier } from "@/lib/stages/stage2-intro";
import { hidePromptEcho, type LiveTurn } from "@/components/stages/loop/realtime-voice";

describe("Stage 2 recap: 'Earlier you picked …' (QA qa6 95b78e8f)", () => {
  const answer =
    "I want to use Sam Walton. I think he shows servant and transformational leadership, I just want to make sure I hit every requirement. When Walmart grew fast in the 80s and 90s, Walton visited stores and listened to associates, which is servant leadership, and his big vision of low prices for families kept people bought in during change.";
  const decision = { at: 1, pick: "Transformational", answer, source: "stated" as const, question: "Which leadership style do you want to argue works best here" };
  const leader = { at: 1, pick: "Sam Walton", answer: "", question: "stated" };
  it("an informed pick whose take has no 'because' still names the styles and the leader", () => {
    expect(stage2Earlier(decision as never, leader as never, [])).toBe("Earlier you picked Servant and Transformational with Sam Walton as your example.");
  });
  it("with a reason it keeps the reason (unchanged)", () => {
    expect(stage2Earlier({ ...decision, answer: `${answer} It's the right call because it shows a style from Chapter 4 working in a real change.` } as never, leader as never, [])).toMatch(/^Earlier you picked Servant and Transformational with Sam Walton as your example, because it shows a style from Chapter 4/);
  });
  it("a vague answer with no pick still gets no recap", () => {
    expect(stage2Earlier({ ...decision, pick: "Transformational", answer: "idk" } as never, null, [])).toBeNull();
  });
});

describe("voice transcript: the on-screen prompt she says word for word isn't repeated below it", () => {
  const GATE = "That's everything for Stage 1. Ready for the stance interview?";
  const row = (text: string, extra: Partial<LiveTurn> = {}): LiveTurn => ({ id: "p:r1", who: "pau", text, ...extra });
  it("hides it while it streams and when done (also after a welcome-back line)", () => {
    expect(hidePromptEcho([row("That's everything")], "p:r1", [GATE])[0]!.saved).toBe(true);
    expect(hidePromptEcho([row(GATE)], "p:r1", [GATE])[0]!.saved).toBe(true);
    expect(hidePromptEcho([row(`Welcome back! ${GATE}`)], "p:r1", [GATE])[0]!.saved).toBe(true);
  });
  it("her own words stay; a row it hid comes back once it diverges", () => {
    expect(hidePromptEcho([row("Love that take, Walton's a great pick.")], "p:r1", [GATE])[0]!.saved).toBeFalsy();
    const hid = hidePromptEcho([row("That's")], "p:r1", [GATE]);
    expect(hid[0]!.saved).toBe(true);
    expect(hidePromptEcho([{ ...hid[0]!, text: "That's a real take on change." }], "p:r1", [GATE])[0]!.saved).toBe(false);
    // A row hidden for another reason (saved words) is never un-hidden here.
    expect(hidePromptEcho([row("Something else", { saved: true })], "p:r1", [GATE])[0]!.saved).toBe(true);
  });
});
