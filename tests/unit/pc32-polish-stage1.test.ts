/** PC-32 polish, QA prod smoke 6:50 PM (qa6 9deedb9f) and QA 6:53 PM (qa8 b3d40615). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IDEAS_CHECK_ID,
  IDEAS_CHECK_ASK,
  IDEAS_FOLLOW_ID,
  IDEAS_NUDGE_ID,
  classifyStartingPoint,
  ideasNudge,
  ideasPlan,
  ideasSaid,
  isIdeasStepId,
} from "@/lib/stage1/starting-point";
import { stage2Earlier, titleName } from "@/lib/stages/stage2-intro";

const a = (questionId: string, answerText: string, questionText?: string) => ({ questionId, answerText, ...(questionText ? { questionText } : {}) });
const ctx = { people: ["Satya Nadella", "Indra Nooyi", "Mary Barra"], ask: "Argue which leadership style works best for change, with one real leader, using Chapter 4 of Northouse and Goleman's article." };

describe("#1 no ideas yet: reassure, teach, ONE guiding question, box stays open", () => {
  it("'I have no ideas yet.' gets the nudge step instead of closing Stage 1", () => {
    const plan = ideasPlan([a(IDEAS_CHECK_ID, "I have no ideas yet.", IDEAS_CHECK_ASK)], ctx);
    expect(plan.map((s) => s.id)).toEqual([IDEAS_CHECK_ID, IDEAS_NUDGE_ID]);
    expect(isIdeasStepId(IDEAS_NUDGE_ID)).toBe(true);
  });
  it("the nudge is light: one reassuring line, what the paper needs, one question naming examples", () => {
    const t = ideasNudge(ctx);
    expect(t).toMatch(/^No worries, that's a normal place to start\./);
    expect(t).toMatch(/one real leader and a leadership style they show, tied back to your readings\./);
    expect(t).toMatch(/boss, coach or teacher/);
    expect(t).toContain("Satya Nadella, Indra Nooyi or Mary Barra");
    expect(t.match(/\?/g)).toHaveLength(1);
    expect(t.split(/(?<=[.?!])\s+/).length).toBeLessThanOrEqual(3);
  });
  it("with no example leaders it asks about someone they've had", () => {
    expect(ideasNudge({ ask: ctx.ask })).toMatch(/Is there a boss, coach or teacher you've had who stood out to you, good or bad\?$/);
  });
  it("an idea after the nudge runs the normal summarize-confirm and is saved as their idea", () => {
    const answers = [a(IDEAS_CHECK_ID, "I have no ideas yet."), a(IDEAS_NUDGE_ID, "Sam Walton, servant leadership")];
    const plan = ideasPlan(answers, ctx);
    expect(plan.map((s) => s.id)).toEqual([IDEAS_CHECK_ID, IDEAS_NUDGE_ID, IDEAS_FOLLOW_ID]);
    expect(plan[2]!.text).toBe("Got it. So you're thinking about Sam Walton as an example of servant leadership. Did I get that right?");
    const said = ideasSaid(answers);
    expect(said.ideas).toBe("Sam Walton, servant leadership");
    expect(classifyStartingPoint(said).kind).toBe("has_ideas");
  });
  it("still nothing after the one nudge: Stage 1 wraps up (ghost + Stage 2, the usual reassurance)", () => {
    const answers = [a(IDEAS_CHECK_ID, "I have no ideas yet."), a(IDEAS_NUDGE_ID, "not really, nothing")];
    expect(ideasPlan(answers, ctx).map((s) => s.id)).toEqual([IDEAS_CHECK_ID, IDEAS_NUDGE_ID]);
    expect(classifyStartingPoint(ideasSaid(answers)).kind).toBe("no_clue");
  });
  it("'skip' gets no nudge", () => {
    expect(ideasPlan([a(IDEAS_CHECK_ID, "skip")], ctx).map((s) => s.id)).toEqual([IDEAS_CHECK_ID]);
  });
  it("the server's starting point uses the idea given after the nudge", () => {
    expect(readFileSync("app/api/papers/[paperId]/intake/complete/route.ts", "utf8")).toMatch(/ideas: ideasSaid\(body\.answers\)\.ideas \?\?/);
  });
});

describe("#2 an edited ideas answer goes through summarize-confirm", () => {
  it("editing 'I have no ideas yet' to an idea opens the confirm step (never the gate's 'Love it…', never 'Skipped')", () => {
    // After the edit the later ideas turns are cleared, so the plan's first open step is the confirm.
    const edited = [a(IDEAS_CHECK_ID, "Sam Walton, servant leadership")];
    const plan = ideasPlan(edited, ctx);
    expect(plan.map((s) => s.id)).toEqual([IDEAS_CHECK_ID, IDEAS_FOLLOW_ID]);
    expect(plan[1]!.text).toMatch(/Did I get that right\?$/);
    const open = plan.findIndex((s) => !edited.some((x) => x.questionId === s.id && x.answerText.trim()));
    expect(open).toBe(1);
  });
  it("the intake routes an ideas edit through the fresh plan and clears the later ideas turns", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toMatch(/const editIdeas = Boolean\(editReturn\) && shortStage1 && isIdeasStepId\(q\.id\)/);
    expect(src).toMatch(/if \(back && !editIdeas\) \{\s*returnFromEdit\(nextAnswers\);/);
    expect(src).toMatch(/!clearIds\.includes\(a\.questionId\)/);
    expect(src).toMatch(/clearQuestionIds: clearIds\.length \? clearIds : undefined/);
  });
  it("the server clears them (an empty newer row removes the answer on reload)", () => {
    expect(readFileSync("app/api/papers/[paperId]/intake/next-question/route.ts", "utf8")).toMatch(/clearQuestionIds/);
    expect(readFileSync("app/api/papers/[paperId]/intake/answers/route.ts", "utf8")).toMatch(/latest\.delete\(row\.question_id\)/);
  });
});

describe("QA 6:53 PM: the Stage 2 recap synthesizes, never pastes their raw sentence", () => {
  const d = (answer: string) => ({ pick: "their own", answer, question: "Which style?", at: 0 }) as never;
  it("qa8 b3d40615: leader + style in Pau's words, names capitalized", () => {
    const r = stage2Earlier(d("satya Nadella. I like transformational, because he rebuilt Microsoft's culture."));
    expect(r).toBe("You picked Satya Nadella as a transformational leader, mainly for how he rebuilt Microsoft's culture.");
    expect(r).not.toMatch(/Earlier you told me|satya|\. you /);
  });
  it("other answers keep a name's capital and sentence starts", () => {
    expect(stage2Earlier(d("Mandy taught me to listen because she cared"))).toBe("Earlier you told me Mandy taught you to listen, because she cared.");
    expect(stage2Earlier(d("I think listening matters most because teams need trust"))).toBe("Earlier you told me you think listening matters most, because teams need trust.");
    expect(titleName("satya nadella")).toBe("Satya Nadella");
  });
});

describe("should-fix: general-background leader facts are few, well known and tied to the style", async () => {
  const { COACH_ANSWER_STRUCTURED } = await import("@/lib/coach/answer");
  it("the prompt asks for 2-3 widely documented behaviors that show their style, no precise numbers or anecdotes", () => {
    expect(COACH_ANSWER_STRUCTURED).toMatch(/2-3 best-known, widely documented behaviors that show the student's style/);
    expect(COACH_ANSWER_STRUCTURED).toMatch(/listening to associates, regular store visits, profit sharing/);
    expect(COACH_ANSWER_STRUCTURED).toMatch(/Leave out precise numbers, dates, distances and anecdotes unless they're famous/);
    expect(COACH_ANSWER_STRUCTURED).toMatch(/complete, plain, grammatical sentences/);
  });
  it("the route sends the student's style with the leader", () => {
    expect(readFileSync("app/api/papers/[paperId]/coach/answer/route.ts", "utf8")).toMatch(/student_style: style \?\? ""/);
  });
});
