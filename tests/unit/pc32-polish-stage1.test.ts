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

describe("QA 6:53 PM: Stage 1's reflect-back and Stage 2 starting line keep a lowercase-typed leader", async () => {
  const { ideasConfirm, stage2StartingLine } = await import("@/lib/stage1/starting-point");
  const t = "satya Nadella. I like transformational, because he rebuilt Microsoft's culture";
  it("names the leader, capitalized", () => {
    expect(ideasConfirm(t, true)).toBe("Got it. So you're thinking about Satya Nadella as an example of transformational leadership. Did I get that right?");
    expect(stage2StartingLine({ kind: "has_ideas", ideas: t, readMaterial: false, at: 1 } as never)).toBe("In Stage 1 you said you're thinking about Satya Nadella as an example of transformational leadership. We'll start there.");
  });
});

describe("live walk 7:20 PM: the nudge's teach line ties the paper to the readings", () => {
  it("the read-back's must-include list counts as readings", () => {
    expect(readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8")).toMatch(/\.\.\.\(b\?\.readback\?\.mustInclude \?\? \[\]\)/);
    expect(ideasNudge({ ask: "You are writing an essay on leadership style. Chapter 4 of the textbook (Northouse); the assigned HBR article by Daniel Goleman" })).toMatch(/tied back to your readings\./);
  });
});

describe("live walk 7:25 PM: #71's grounding gate keeps the background label whole", async () => {
  const { groundParas } = await import("@/lib/coach/grounding");
  const { shapeStructuredAnswer } = await import("@/lib/coach/answer");
  it("never turns it into \"I don't have your copy, so here's the general idea: (check before citing):\"", () => {
    const paras = ["From general background (check before citing): Walton visited stores often to talk with associates. He shared profits with associates.", "Which of these habits do you want to build on?"];
    const out = groundParas(paras, { source: "", unreadRefs: ["Northouse, Leadership: Theory and Practice", "What Makes a Leader? by Daniel Goleman"] }).paras;
    expect(out).toEqual(paras);
    expect(out.join(" ")).not.toMatch(/general idea: \(check before citing\)/);
  });
  it("at most three background facts", () => {
    const r = shapeStructuredAnswer({
      raw: { explain: "", readingPoints: [], leaderFacts: ["Walton visited his stores often to talk with associates on the floor.", "Walton asked managers to listen first to the associates who stocked shelves.", "Walton set up profit sharing so associates shared in the company's growth.", "Walton drove an old pickup truck around Bentonville for decades."], question: "Which of these habits fits your introduction best?" },
      message: "How did Sam Walton show servant leadership?",
      leader: "Sam Walton",
      readings: [],
    });
    const bg = r.paras.find((p) => p.startsWith("From general background"))!;
    expect(bg).not.toMatch(/pickup/);
  });
});

describe("live walk 7:31 PM: a reading paragraph never gets the R2 prefix stacked on its own label", async () => {
  const { groundParas } = await import("@/lib/coach/grounding");
  it("'From your Northouse chapter: …' stays as is; an unlabeled claim still gets the prefix", () => {
    const out = groundParas(
      ["Servant leadership centers on putting the needs of team members first.", "From your Northouse chapter: Northouse surveys servant leadership among the major approaches.", "Northouse describes servant leadership as putting followers first."],
      { source: "", unreadRefs: ["Northouse, Leadership: Theory and Practice"] },
    ).paras;
    expect(out[1]).toBe("From your Northouse chapter: Northouse surveys servant leadership among the major approaches.");
    expect(out[2]).toMatch(/^I don't have your copy, so here's the general idea: Northouse describes/);
  });
});

describe("live walk 7:36 PM: #71's prose gate lets the labeled background facts through", async () => {
  const { gateParas } = await import("@/lib/coach/prose-gate");
  const facts = "Sam Walton made regular store visits to listen directly to associates and customers. Sam Walton introduced profit-sharing plans that let employees own part of the company. Sam Walton kept store-level decisions close to the people doing the work instead of centralizing them at headquarters.";
  const o = { names: ["Sam Walton"], context: "How did Sam Walton show servant leadership? Introduction" };
  it("labeled facts pass (never the 'what's the main point you want your intro to set up?' reframe)", () => {
    const r = gateParas([`From general background (check before citing): ${facts}`, "Which of those actions feels strongest for your paper?"], o);
    expect(r.blocked).toBe(false);
    expect(r.paras[0]).toContain("profit-sharing");
  });
  it("the same sentences with no label are still gated as before", async () => {
    const { findPasteableRuns } = await import("@/lib/coach/prose-gate");
    const more = `${facts} Walton believed the people closest to customers knew best what the stores and their shoppers needed every single day.`;
    expect(findPasteableRuns([more], o).length).toBeGreaterThan(0);
    expect(gateParas([`From general background (check before citing): ${more}`], o).blocked).toBe(false);
  });
});
