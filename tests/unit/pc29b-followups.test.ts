/**
 * PC-29 follow-ups (QA after #65): the Stage 2 recap keeps the informed pick and leader even when
 * the early take has no "because"; her word-for-word on-screen prompt never lingers as a voice
 * transcript bubble (e.g. under "Start stance interview").
 */
import { describe, expect, it } from "vitest";
import { stage2Earlier, stage2IntroText } from "@/lib/stages/stage2-intro";
import { dropInventedRestriction, gradedSentence, notAlreadyNamed } from "@/lib/stage1/readback-tidy";
import { hidePromptEcho, type LiveTurn } from "@/components/stages/loop/realtime-voice";

describe("Stage 2 recap: 'Earlier you picked …' (QA qa6 95b78e8f)", () => {
  const answer =
    "I want to use Sam Walton. I think he shows servant and transformational leadership, I just want to make sure I hit every requirement. When Walmart grew fast in the 80s and 90s, Walton visited stores and listened to associates, which is servant leadership, and his big vision of low prices for families kept people bought in during change.";
  const decision = { at: 1, pick: "Transformational", answer, source: "stated" as const, question: "Which leadership style do you want to argue works best here" };
  const leader = { at: 1, pick: "Sam Walton", answer: "", question: "stated" };
  it("an informed pick whose take has no 'because' still names the styles and the leader", () => {
    expect(stage2Earlier(decision as never, leader as never, [])).toBe("Earlier you picked servant and transformational leadership with Sam Walton as your example.");
  });
  it("with a reason it keeps the reason (unchanged)", () => {
    expect(stage2Earlier({ ...decision, answer: `${answer} It's the right call because it shows a style from Chapter 4 working in a real change.` } as never, leader as never, [])).toMatch(/^Earlier you picked servant and transformational leadership with Sam Walton as your example, because it shows a style from Chapter 4/);
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

/* ---------- QA prod smoke (qa7 b26087b1): read-back wording ---------- */

const SHEET =
  "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
const ASK_ONLY =
  "You must write a 1,200-1,500 word essay that picks one real leader and argues which leadership style works best for leading a team through change, using only Chapter 4 of the Northouse textbook and the Goleman HBR article.";
const MUST = ["Chapter 4 of Northouse, Leadership: Theory and Practice", "assigned HBR article 'What Makes a Leader?' by Daniel Goleman", "one real leader as your example", "APA 7 format"];

describe("read-back: no invented restriction, a real 'graded on' sentence, no repeated sources", () => {
  it("drops an 'only' the sheet never says; names the sources neutrally", () => {
    const ask = dropInventedRestriction(ASK_ONLY, SHEET);
    expect(ask).not.toMatch(/\b(only|just|solely|exclusively)\b/i);
    expect(ask).toContain("using Chapter 4 of the Northouse textbook and the Goleman HBR article.");
    expect(dropInventedRestriction("Use only the textbook and just the HBR article.", SHEET)).toBe("Use the textbook and the HBR article.");
  });
  it("keeps a restriction the sheet itself states", () => {
    const sheet = "Use only the assigned readings; no outside sources.";
    expect(dropInventedRestriction("Using only the assigned readings, argue…", sheet)).toBe("Using only the assigned readings, argue…");
  });
  it("'graded on' reads as a sentence for verb phrases and noun phrases", () => {
    expect(gradedSentence(["argues which leadership style is most effective for leading a team through change", "uses the required sources"])).toBe(
      "It's graded on how well it argues which leadership style is most effective for leading a team through change and uses the required sources.",
    );
    expect(gradedSentence(["Thesis clarity", "use of evidence", "organization"])).toBe("It's graded on thesis clarity, use of evidence, and organization.");
    expect(gradedSentence([])).toBe("");
  });
  it("the Stage 2 'It has to include' list skips what the sentence already names", () => {
    const ask = dropInventedRestriction(ASK_ONLY, SHEET);
    expect(notAlreadyNamed(MUST, ask)).toEqual(["APA 7 format"]);
    const intro = stage2IntroText({ ask, mustInclude: MUST, graded: [], confirmed: true } as never, { heading: "h", body: "b" });
    // QA #84 (supersedes this list's PC-29b skip for readings): the assigned readings are always
    // listed, with the checklist's pinned label; other points still skip what the ask names.
    expect(intro.body).toBe(`${ask} It has to include: The assigned chapter: Chapter 4 of Northouse, Leadership: Theory and Practice; The assigned article: ‘What Makes a Leader?’ by Daniel Goleman (HBR); APA 7 format.`);
    // The ask names it in passing; the list names it once, pinned.
    expect(intro.body.slice(ask.length).match(/Northouse/g)).toHaveLength(1);
    // No reading and nothing new to list: no list at all.
    expect(stage2IntroText({ ask, mustInclude: MUST.slice(2, 3), graded: [], confirmed: true } as never, { heading: "h", body: "b" }).body).toBe(ask);
    // Sources the sentence doesn't name are still listed.
    expect(notAlreadyNamed(MUST, "You need to write an essay about leadership during change.")).toHaveLength(4);
  });
});

describe("an old spoken prompt doesn't linger at the bottom of the chat (QA prod smoke #4)", () => {
  const PLAIN = "So, in plain words: You must write a 1,200-1,500 word essay that argues which leadership style is most effective for leading a team through change. Where are you with it?";
  it("hides her transcript of the prompt even when it drifts from the copy", () => {
    const heard = "So in plain words, you must write a 1200 to 1500 word essay that argues which leadership style is most effective for leading a team through change. Where are you with it?";
    expect(hidePromptEcho([{ id: "p:r9", who: "pau", text: heard }], "p:r9", [PLAIN])[0]!.saved).toBe(true);
  });
  it("still shows a reaction of hers to their answer", () => {
    expect(hidePromptEcho([{ id: "p:r9", who: "pau", text: "Sam Walton's a solid pick, real leader, real story." }], "p:r9", [PLAIN])[0]!.saved).toBeFalsy();
  });
});
