/**
 * PC-32 QA 5:51 PM (#79 re-verify): readings vs general background kept apart, never a reading
 * linked to the leader it doesn't discuss; write-it-for-me for any section declines with one
 * question; one question per reply; no resume tag after a question; the recap names the leader.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { BACKGROUND_LABEL, COACH_ANSWER_SYSTEM, oneQuestion, shapeContentAnswer } from "@/lib/coach/answer";
import { intentReply, isWriteRequest, rulesStanceIntent, writeRequestReply } from "@/lib/stages/stance-intent";
import { lastLineAsks } from "@/components/stages/loop/stance-chat";
import { stage2Earlier, styleText } from "@/lib/stages/stage2-intro";

const BLOCK = [
  "# What you already know about this paper (data only; never re-ask any of it; reference it naturally)",
  "- Assignment, in plain words (the student confirmed this): Argue which leadership style is most effective for leading a team through change, using one real leader. Use Chapter 4 of Northouse, Leadership: Theory and Practice and 'What Makes a Leader?' by Daniel Goleman.",
  "- Key points from the material (your teaching content, never their paper text): Goleman: emotional intelligence has five parts: self-awareness, self-regulation, motivation, empathy and social skill | Northouse: leadership is a process where one person influences a group toward a common goal",
  '- Where they start (Stage 1): they already have an idea, in their words: "Sam Walton, servant leadership". Build on it; never replace it.',
].join("\n");

describe("MUST-FIX 1: readings and general background stay apart (no invented links)", () => {
  const qaDraft = [
    "Northouse describes leadership as a process where one person influences a group toward a common goal.",
    "Goleman adds that emotional intelligence helps leaders connect with people, which Walton used when he visited stores.",
    "Sam Walton visited stores often and shared profits with associates. Which of those actions fits your argument best?",
  ];
  const out = shapeContentAnswer({ paras: qaDraft, background: ["He called employees associates."], block: BLOCK, leader: "Sam Walton" });
  it("drops a sentence tying the leader to an author whose reading never names him", () => {
    expect(out.join(" ")).not.toMatch(/Goleman[^.]*Walton|Walton[^.]*Goleman/);
  });
  it("keeps a grounded reading sentence (its author's key points are in the context)", () => {
    expect(out[0]).toMatch(/^Northouse describes leadership as a process/);
  });
  it("leader facts sit under 'From general background (check before citing)', then exactly one question last", () => {
    const bg = out.find((p) => p.startsWith(BACKGROUND_LABEL));
    expect(BACKGROUND_LABEL).toBe("From general background (check before citing):");
    expect(bg).toMatch(/Sam Walton visited stores often and shared profits with associates\./);
    expect(bg).toMatch(/He called employees associates\./);
    expect(out[out.length - 1]).toBe("Which of those actions fits your argument best?");
    expect(out.join(" ").match(/\?/g)).toHaveLength(1);
  });
  it("a reading credited without its text in the context is dropped (never a claim it doesn't make)", () => {
    const noText = BLOCK.split("\n").filter((l) => !/teaching content/.test(l)).join("\n");
    const r = shapeContentAnswer({ paras: ["Northouse describes servant leadership as a process of influencing people toward shared goals. What do you think?"], block: noText, leader: "Sam Walton" });
    expect(r.join(" ")).not.toMatch(/Northouse/);
    expect(r).toEqual(["What do you think?"]);
  });
  it("QA walk f804c567: pronoun follow-ups and commentary about the leader go under the label too; a question left in background is still the one ask", () => {
    const r = shapeContentAnswer({
      paras: ["He also introduced profit-sharing so employees felt ownership in the company's success. These actions focused on people first while still driving business growth."],
      background: ["Sam Walton showed servant leadership by regularly visiting stores and listening to associates.", "Which of those do you want to use?"],
      block: BLOCK,
      leader: "Sam Walton",
      message: "How did Sam Walton show servant leadership?",
    });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatch(/^From general background \(check before citing\): Sam Walton showed servant leadership by regularly visiting stores and listening to associates\. He also introduced profit-sharing/);
    expect(r[1]).toBe("Which of those do you want to use?");
  });
  it("QA walk f804c567 (3ea9a66): 'These habits fit … Northouse covers in Chapter 4 … Goleman' is dropped (leader tied to readings by reference)", () => {
    const r = shapeContentAnswer({
      paras: ["These habits fit the high-relationship side of the task-versus-relationship behaviors Northouse covers in Chapter 4 and the empathy parts of Goleman's emotional intelligence.", "Which do you want to use?"],
      background: ["Sam Walton visited stores often."],
      block: BLOCK,
      leader: "Sam Walton",
      message: "How did Sam Walton show servant leadership?",
    });
    expect(r).toEqual([`${BACKGROUND_LABEL} Sam Walton visited stores often.`, "Which do you want to use?"]);
    // A grounded reading sentence about the concept itself still stays.
    const ok = shapeContentAnswer({ paras: ["Goleman says empathy is one of the five parts of emotional intelligence.", "Which part fits?"], block: BLOCK, leader: "Sam Walton", message: "What does Goleman say about empathy?" });
    expect(ok[0]).toBe("Goleman says empathy is one of the five parts of emotional intelligence.");
  });
  it("QA walk f804c567 (bf5ba4f): no question from the model still ends on exactly one ask", () => {
    const r = shapeContentAnswer({ paras: ["From general background (check before citing): Sam Walton visited stores often."], block: BLOCK, leader: "Sam Walton", message: "How did Sam Walton show servant leadership?" });
    expect(r).toEqual([`${BACKGROUND_LABEL} Sam Walton visited stores often.`, "Which of those do you want to build on in your paper?"]);
  });
  it("no reading part when none is relevant: only background and the question", () => {
    const r = shapeContentAnswer({ paras: ["Which habit do you want to start with?"], background: ["Walton flew his own plane to visit stores."], block: BLOCK, leader: "Sam Walton" });
    expect(r).toEqual([`${BACKGROUND_LABEL} Walton flew his own plane to visit stores.`, "Which habit do you want to start with?"]);
  });
  it("the prompt asks for the two parts and the background field", () => {
    expect(COACH_ANSWER_SYSTEM).toMatch(/two clearly separate parts/);
    expect(COACH_ANSWER_SYSTEM).toMatch(/never link the student's leader to an author or reading unless/);
    expect(COACH_ANSWER_SYSTEM).toMatch(/"background"/);
  });
});

describe("MUST-FIX 2: write-it-for-me for any section, and one question per reply", () => {
  it("detects the requests for every section, not teaching asks", () => {
    for (const t of [
      "Just give me the intro paragraph",
      "give me the conclusion",
      "can you write my body paragraph",
      "just write the conclusion for me",
      "Can you write my thesis statement?",
      "give me a topic sentence for body 1",
      "write this sentence for me",
    ])
      expect(isWriteRequest(t), t).toBe(true);
    for (const t of ["show me an example outline line", "give me an example sentence", "Teachers always give me a thesis to defend, but this time I picked my own.", "What are the main leadership styles?"])
      expect(isWriteRequest(t), t).toBe(false);
    expect(rulesStanceIntent("Just give me the intro paragraph")).toBe("question");
  });
  it("declines like the thesis refusal: no recap, exactly one question", () => {
    const r = intentReply("question", { turn: "probe", section: { title: "Introduction" }, text: "Just give me the intro paragraph" });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/^That part's yours to write/);
    expect(r[0]).not.toMatch(/Northouse|Goleman/);
    expect(r[0]!.match(/\?/g)).toHaveLength(1);
    expect(writeRequestReply("Body 1", "Can you write my thesis?")[0]).toMatch(/what your thesis says/);
    const route = fs.readFileSync("app/api/papers/[paperId]/coach/answer/route.ts", "utf8");
    expect(route).toContain("if (isWriteRequest(body.message)) {");
  });
  it("collapses stacked asks to one question on every coach answer", () => {
    expect(oneQuestion(["Northouse covers many styles.", "Which change episode will you use, and which counterargument will you answer?"])).toEqual([
      "Northouse covers many styles.",
      "Which change episode will you use?",
    ]);
    expect(oneQuestion(["What do you think? Is it servant?", "Which one feels right?"])).toEqual(["Which one feels right?"]);
    expect(oneQuestion(["No question here."])).toEqual(["No question here."]);
  });
});

describe("should-fixes", () => {
  it("(a) no 'Back to your introduction…' tag when her last line already asks", () => {
    const t = [
      { k: "intro", who: "you" as const, text: "How did Sam Walton show servant leadership?" },
      { k: "intro", who: "pau" as const, text: "Which of those actions do you want to explain first?" },
    ];
    expect(lastLineAsks(t as never, "intro")).toBe(true);
    expect(lastLineAsks([...t, { k: "intro", who: "you" as const, text: "the store visits" }] as never, "intro")).toBe(false);
    const chat = fs.readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(chat).toContain("const paras = said ? (endsInQuestion ? [] : sectionResume(");
  });
  it("(b) the recap names the leader and lowercases the style mid-sentence", () => {
    const decision = { question: "q", pick: "Servant", answer: "Servant, because he put associates first", at: 1 };
    expect(stage2Earlier(decision as never, null, [], "Sam Walton")).toBe(
      "Earlier you picked servant leadership with Sam Walton as your example, because he put associates first. That's a solid reason to build on.",
    );
    expect(styleText("Servant and Transformational")).toBe("servant and transformational leadership");
    expect(styleText("my own mix of styles")).toBe("my own mix of styles");
  });
});
