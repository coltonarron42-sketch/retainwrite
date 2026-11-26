/**
 * QA 6:03 AM bundle: read-back confirm, material for every named reading,
 * decision probing, the north-star gate and template fixes.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isQuickConfirm, rulesClassify } from "@/lib/stage1/confirm-reply";
import {
  cleanPoints,
  currentSummaries,
  decisionHasReason,
  guessPick,
  isOptionsRequest,
  isReadingQuestion,
  isVaguePick,
  looksLikePastedReading,
  preConfirmRoute,
  statedStance,
  stripHollowPraise,
  stripReadingRefusal,
  vaguePickProbe,
  withoutDarkWeb,
  type MaterialSummary,
  type PaperContext,
} from "@/lib/stage1/paper-context";
import { namedWorksFrom, readingsLine, titlesInText } from "@/lib/stage1/readings";
import { readBackParas } from "@/lib/stage1/pau-pau";
import { northstarChecklist, northstarGateFrom, shortNoteNudge, stanceStartBlockers } from "@/lib/stage1/intake-resume";
import { optionsAgain, stage2Earlier, stage2IntroText } from "@/lib/stages/stage2-intro";
import { intentReply, isWriteRequest, rulesStanceIntent } from "@/lib/stages/stance-intent";
import { cleanCoachAnswer, COACH_ANSWER_SYSTEM } from "@/lib/coach/answer";
import { cleanTopic } from "@/lib/copy/topic-phrase";
import { practitionerReason } from "@/lib/stage1/leads";
import { assignmentPurposeLine, isTitleLike, stageLessonHeader } from "@/lib/coaching/exampleLeads";
import type { AssignmentRequirements } from "@/lib/assignment/schema";

const req = JSON.parse(readFileSync("tests/fixtures/req-bus210.json", "utf8")) as AssignmentRequirements;
const OPTIONS = [
  { label: "Transformational leadership", why: "Inspires people to buy into the change." },
  { label: "Team-based leadership", why: "Shares the work of change across the group." },
  { label: "Servant leadership", why: "Puts the team's needs first while things shift." },
];
const sum = (kind: MaterialSummary["kind"], title: string, points: string[], at = 1): MaterialSummary => ({ kind, title, points, sources: [], at });

describe("1. read-back confirm", () => {
  it("natural confirms are accepted", () => {
    expect(isQuickConfirm("looks good, I have the readings")).toBe(true);
    expect(isQuickConfirm("yep that's right")).toBe(true);
    expect(isQuickConfirm("looks good but it's 2,000 words")).toBe(false);
  });
  it("pre-confirm questions are routed and answered in place", () => {
    expect(preConfirmRoute("idk what this even means")).toBe("explain");
    expect(preConfirmRoute("what is Goleman saying?")).toBe("material");
    expect(preConfirmRoute("just tell me what the options are")).toBe("options");
    const r = rulesClassify("what is Goleman saying?", null);
    expect(r.route).toBe("material");
    expect(r.reply).not.toMatch(/can'?t summari|doing the reading/i);
  });
  it("every reading refusal line is stripped", () => {
    expect(stripReadingRefusal("I can't summarize Goleman for you, that'd be doing the reading. Here's the idea: EI matters.")).toBe("Here's the idea: EI matters.");
    expect(cleanCoachAnswer(["That would be doing the reading for you. Goleman names five parts."])).toEqual(["Goleman names five parts."]);
    expect(COACH_ANSWER_SYSTEM).toMatch(/Never refuse to explain or summarize/);
    expect(readFileSync("lib/voice/realtime/persona.ts", "utf8")).toMatch(/Never refuse to explain or summarize/);
  });
  it("the confirm card has a visible Confirm button", () => {
    const src = readFileSync("components/stages/stage1/pau-pau-confirm.tsx", "utf8");
    expect(src).toContain("noGist");
    expect(src).toContain("Looks right, let's start");
    expect(src).toContain("answerInPlace");
  });
});

describe("2. material for every named reading", () => {
  const ASG =
    "Read the handout “Notes on the Quiet Kitchen” and the short story “The Long Table” by Ana Ruiz. Write 600-800 words on what the two say about family meals.";
  it("handouts and readings named in the sheet are all found", () => {
    expect(titlesInText(ASG)).toEqual(["Notes on the Quiet Kitchen", "The Long Table by Ana Ruiz"]);
    const works = namedWorksFrom({}, ASG);
    expect(works).toHaveLength(2);
    expect(readingsLine(works, "Write about family meals.")).toMatch(/Readings to cover: .*Notes on the Quiet Kitchen.*Long Table/);
  });
  it("the BUS 210 read-back lists Northouse and Goleman and has no ',200' typo", () => {
    const text = readBackParas(req, { sheetText: "" }).join(" ");
    expect(text).toMatch(/Goleman/);
    expect(text).toMatch(/Northouse/);
    expect(text).not.toMatch(/(^|\s),200/);
    expect(cleanPoints(["1,200-1,500 words", "• Goleman's five EI parts"])).toEqual(["1,200-1,500 words", "Goleman's five EI parts"]);
  });
  it("a reading question is a question, never an answer", () => {
    expect(isReadingQuestion("what does Notes on the Quiet Kitchen say?")).toBe(true);
    expect(isReadingQuestion("I'd pick team-based because it shares the work")).toBe(false);
  });
  it("a pasted reading paragraph is material, never their answer", () => {
    const para =
      "Family meals have long served as a ritual of belonging. In the households studied, the evening table was where news was exchanged, disputes were softened, and children learned the unwritten rules of the family. The kitchen itself became a quiet witness to these exchanges, its routines shaping who spoke and who listened. Over time, these small rituals accumulated into a shared identity that outlasted any single conversation held there.";
    expect(looksLikePastedReading(para, 1)).toBe(true);
    expect(looksLikePastedReading(para, 0)).toBe(true);
    expect(looksLikePastedReading("I think family meals matter because my mom always made us talk at dinner and I learned a lot from it, honestly more than school.", 0)).toBe(false);
  });
  it("summaries keep every reading (reading, found, knowledge), newest per title", () => {
    const ctx: PaperContext = {
      v: 1,
      summaries: [sum("reading", "Notes on the Quiet Kitchen", ["a"], 1), sum("found", "Goleman", ["b"], 2), sum("knowledge", "Northouse Ch. 4", ["c"], 3), sum("found", "Goleman", ["b2"], 4)],
    };
    const got = currentSummaries(ctx);
    expect(got.map((s) => s.title).sort()).toEqual(["Goleman", "Northouse Ch. 4", "Notes on the Quiet Kitchen"]);
    expect(got.find((s) => s.title === "Goleman")!.points).toEqual(["b2"]);
  });
  it("Goleman's five components are required by the prompts; seller links are deduped", () => {
    const brief = readFileSync("lib/server/paper-context/brief.ts", "utf8");
    expect(brief).toMatch(/self-awareness, self-regulation, motivation, empathy, social skill/);
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toMatch(/x\.title === o\.title && x\.seller === o\.seller/);
  });
  it("'Say it simpler' keeps every reading and results append", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain("data-more-groups");
    expect(intake).toMatch(/setMore\(\(prev\) => \[\.\.\.prev,/);
    const route = readFileSync("app/api/papers/[paperId]/intake/brief/route.ts", "utf8");
    expect(route).toMatch(/groups/);
  });
  it("the dark web line is said at most once", () => {
    expect(withoutDarkWeb("I can't find it free online, and I'm not going to the dark web! Got a copy?")).toBe("I can't find it free online. Got a copy?");
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain("darkWebOk={false}");
    expect(readFileSync("components/stages/stage1/pau-pau-confirm.tsx", "utf8")).toContain("withoutDarkWeb(v.missingAsk)");
  });
  it("prefetch starts at the read-back; the catch-up shows 'Digging it up' right away", () => {
    const route = readFileSync("app/api/papers/[paperId]/intake/brief/route.ts", "utf8");
    expect(route).toContain("prefetchAt");
    expect(readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8")).toContain("Digging it up");
  });
});

describe("3. decision", () => {
  it("a vague pick is probed by name", () => {
    expect(isVaguePick("idk, the team one I guess")).toBe(true);
    expect(guessPick("idk, the team one I guess", OPTIONS)?.label).toBe("Team-based leadership");
    expect(vaguePickProbe("idk, the team one I guess", OPTIONS)).toMatch(/leaning toward team-based leadership\. Why that one\?/);
    expect(decisionHasReason("I'd pick transformational because it helps a team buy into change")).toBe(true);
    expect(decisionHasReason("idk")).toBe(false);
    // No lean to name: the probe lists the options and nothing is prefilled.
    const two = [OPTIONS[0]!, { label: "Transactional leadership", why: "" }];
    expect(guessPick("idk, the team one I guess", two)).toBeNull();
    expect(vaguePickProbe("idk, the team one I guess", two)).toMatch(/^Which one are you leaning toward/);
    expect(readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8")).toContain("guessPick(text, opts2);");
  });
  it("a prepared student's stance is captured without 'I read both'", () => {
    const s = statedStance("Yes, I read both. I'm going with transformational, Satya Nadella.", OPTIONS);
    expect(s).toBe("I'm going with transformational, Satya Nadella.");
    expect(statedStance("idk", OPTIONS)).toBeNull();
  });
  it("a real-leader assignment asks for a leader with real options", () => {
    const brief = readFileSync("lib/server/paper-context/brief.ts", "utf8");
    expect(brief).toMatch(/NEEDS_REAL_PERSON/);
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain('id: "leader_pick"');
    expect(intake).toContain('id: "decision_why"');
  });
  it("Stage 2 carries the actual decision and reason, never idk", () => {
    expect(stage2Earlier({ question: "q", pick: "Transformational leadership", answer: "I'd pick transformational because it helps a team buy into change", at: 1 })).toBe("Earlier you picked Transformational leadership, because it helps a team buy into change. That's a solid reason to build on.");
    expect(stage2Earlier({ question: "q", pick: "their own", answer: "idk", at: 1 })).toBeNull();
    expect(stage2Earlier({ question: "q", pick: "their own", answer: "I read both", at: 1 })).toBeNull();
    expect(stage2Earlier({ question: "q", pick: "their own", answer: "Transformational, because Nadella got Microsoft to change how it works", at: 1 })).toMatch(/^Earlier you told me transformational, because Nadella/);
  });
  it("Stage 2 'just tell me some options' reuses the Stage 1 options as chips", () => {
    expect(isOptionsRequest("just tell me some options")).toBe(true);
    const again = optionsAgain(OPTIONS);
    expect(again?.chips).toEqual(OPTIONS.map((o) => o.label));
    expect(again?.paras[0]).toMatch(/options from earlier: Transformational leadership/);
    expect(readFileSync("components/stages/loop/stance-chat.tsx", "utf8")).toContain("data-option-chip");
  });
});

describe("4. gate and checklist", () => {
  it("the checklist has the four north-star items", () => {
    expect(northstarChecklist({ confirmed: true, catchUpDone: true, decided: false, stanceOk: false }).map((i) => i.label)).toEqual([
      "Assignment confirmed",
      "Material: caught up",
      "Decision made, with your reason",
      "Early take: a few sentences in your own words",
    ]);
  });
  it("skips and reasonless picks never count", () => {
    expect(northstarGateFrom({ answers: [{ questionId: "material_check", answerText: "", skipped: true }] }).catchUpDone).toBe(false);
    expect(northstarGateFrom({ answers: [{ questionId: "decision_pick", answerText: "idk the team one" }] }).decided).toBe(false);
    expect(
      northstarGateFrom({ answers: [{ questionId: "material_check", answerText: "I haven't read it" }], decisionAnswer: "I'm going with transformational, Satya Nadella." }).decided,
    ).toBe(false);
    expect(
      northstarGateFrom({
        answers: [{ questionId: "decision_why", answerText: "because he got a whole company to change how it thinks" }],
        decisionAnswer: "I'm going with transformational, Satya Nadella.",
      }).decided,
    ).toBe(true);
    expect(northstarGateFrom({ answers: [], decisionAnswer: "Team-based because it shares the work of change", needsLeader: true }).decided).toBe(false);
    expect(stanceStartBlockers({ checklistConfirmed: true, hasStory: true, voiceOk: true, stanceOk: true, northstar: { catchUpDone: true, decided: false } })).toContain("Pick a direction and tell me why.");
  });
  it("a friendly nudge replaces the bare counter", () => {
    expect(shortNoteNudge("stance", 8)).not.toMatch(/\d/);
    expect(shortNoteNudge("stance", 30)).toBeNull();
    expect(readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8")).not.toMatch(/so far\)/);
  });
  it("prepared students skip the hobby and APA-comfort detour; server gates stay", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toMatch(/!skippedInterest && !prepared/);
    expect(intake).toMatch(/\(!prepared && !getToKnowOff\) \|\| has\("bg_comfort"\)/);
    expect(readFileSync("app/api/papers/[paperId]/intake/complete/route.ts", "utf8")).toMatch(/25/);
  });
});

describe("5. template bugs", () => {
  it("the Stage 2 header uses the read-back, never 'How <title> shows up'", () => {
    expect(isTitleLike("BUS 210 Leadership essay for Prof")).toBe(true);
    expect(stageLessonHeader("BUS 210 Leadership essay for Prof", "")).toBe("What this assignment is asking you to learn");
    expect(assignmentPurposeLine("BUS 210 Leadership essay for Prof")).not.toMatch(/teaches BUS/);
    const intro = stage2IntroText({ ask: "Argue which leadership style works best for leading change.", mustInclude: ["one real leader", "Northouse Ch. 4"], graded: [] }, { heading: "x", body: "y" });
    expect(intro.heading).toBe("Your assignment, in plain words");
    expect(intro.body).toMatch(/It has to include: one real leader; Northouse Ch\. 4\./);
  });
  it("the topic phrase drops the instruction words", () => {
    expect(cleanTopic(req.topic.value)).toBe("which leadership style is most effective for leading a team through change");
    expect(practitionerReason(req.topic.value)).not.toMatch(/using one real leader|arguing/);
    expect(practitionerReason("what the two readings say about why family meals matter, and whether you agree")).toMatch(/your question/);
    expect(practitionerReason("whether stress helps or hurts memory")).not.toMatch(/“hurts memory”/);
  });
  it("Stage 2 has no 'Good question.' opener and declines write requests warmly", () => {
    const sec = { title: "Introduction" };
    expect(intentReply("question", { turn: "probe", section: sec })[0]).not.toMatch(/^Good question/);
    expect(intentReply("content_question", { turn: "probe", section: sec })[0]).not.toMatch(/^Good question/);
    expect(isWriteRequest("Can you just write my intro paragraph for me?")).toBe(true);
    expect(rulesStanceIntent("Can you just write my intro paragraph for me?")).toBe("question");
    expect(intentReply("question", { turn: "probe", section: sec, text: "Can you just write my intro paragraph for me?" })[0]).toMatch(/^That part's yours to write/);
  });
  it("no hollow praise for an idk student", () => {
    expect(stripHollowPraise("Great question! Here are the key points.")).toBe("Here are the key points.");
    expect(stripHollowPraise("That's a great start. Which style?")).toBe("Which style?");
    expect(cleanCoachAnswer(["Love that! Here's the gist."], { mode: "lost", message: "idk" })).toEqual(["Here's the gist."]);
    expect(cleanCoachAnswer(["Nice point about Nadella."], { mode: "answer", message: "who is a good example?" })).toEqual(["Nice point about Nadella."]);
  });
});

describe("preview walk follow-ups", () => {
  it("a shared word like 'team' is not a pick", async () => {
    const { pickFrom } = await import("@/lib/stage1/paper-context");
    const grid = [{ label: "Team Management (9,9)", why: "" }, { label: "Authority-Compliance (9,1)", why: "" }];
    expect(pickFrom("I'd pick transformational because it helps a team get through change", grid)).toBe("their own");
    expect(pickFrom("Team management, because it balances task and people", grid)).toBe("Team Management (9,9)");
    expect(stage2Earlier({ question: "q", pick: "Team Management (9,9)", answer: "I'd pick transformational because it helps a team get through change", at: 1 })).toBe("Earlier you told me you'd pick transformational, because it helps a team get through change.");
  });
});
