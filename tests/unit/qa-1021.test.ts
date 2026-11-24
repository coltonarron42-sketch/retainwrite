/** QA 10:21 AM round-5 bundle (walk C blocker + 1-6). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { northstarGateFrom } from "@/lib/stage1/intake-resume";
import { decisionHasReason, decisionQuestion } from "@/lib/stage1/paper-context";
import { conceptTeachCard, defaultTeachCard } from "@/lib/coaching/teach";
import { outlineGap } from "@/lib/stages/outline-map";
import { exampleLeadBatch } from "@/lib/coaching/exampleLeads";

const WALK_C = "I read both. Goleman says emotional intelligence matters more than IQ for leaders; Northouse ch 4 covers the behavioral approach, task vs relationship. I want to argue transformational leadership, using Satya Nadella at Microsoft.";

describe("BLOCKER walk C", () => {
  it("the multi-intent pick has no reason, so its why is asked (not only for short picks)", () => {
    expect(decisionHasReason(WALK_C)).toBe(false);
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("!decisionHasReason(pickSaid)");
    expect(src).toMatch(/shortPick \|\| noReason/);
  });
  it("the early take's reason counts for an existing pick (QA's stuck paper recovers on reload)", () => {
    const g = northstarGateFrom({
      answers: [
        { questionId: "material_check", answerText: "I've read it" },
        { questionId: "decision_pick", answerText: WALK_C },
        { questionId: "stance_early", answerText: "I think transformational works best for change because a leader like Nadella gives people a reason to want it, and he changed Microsoft's culture a lot." },
      ],
      decisionAnswer: WALK_C,
      needsLeader: true,
      leaderAnswer: WALK_C,
    });
    expect(g.decided).toBe(true);
  });
  it("an early take never stands in for a missing pick", () => {
    const g = northstarGateFrom({ answers: [{ questionId: "stance_early", answerText: "I think it works because people believe in it and want the change badly." }] });
    expect(g.decided).toBe(false);
  });
  it("the current question is tracked by id when the plan shrinks, and a dead gate re-asks", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("curQId.current");
    expect(src).toContain("One thing before the stance interview: I still need the reason behind your pick.");
    expect(src).toContain('setForceRecover(data.reask ?? "decision_why")');
  });
  it("the server restores a pick from the answers and says what to re-ask", () => {
    const src = readFileSync("app/api/papers/[paperId]/intake/complete/route.ts", "utf8");
    expect(src).toContain("reask");
    expect(src).toContain('a.questionId === "decision_pick"');
  });
  it("a status shows in the same tick as send on every path", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toMatch(/setSubmitting\(true\);\n\s+\/\/ QA 10:21[\s\S]{0,400}setAsideBusy\(/);
  });
});

describe("1. Body quick lesson is about their pick, never the assignment clause", () => {
  it("from their notes when the paper context hasn't loaded", () => {
    const c = conceptTeachCard({ decision: { pick: "", answer: "I think transformational leadership works best for leading a team through change" } }, "r");
    expect(c?.concept).toBe("transformational leadership");
  });
  it("the fallback card never reads the assignment back", () => {
    const c = defaultTeachCard("arguing which leadership style is most effective for leading a team through change", "r");
    expect(`${c.definition} ${c.ask}`).not.toMatch(/assignment asks|arguing which|interests you most/);
  });
});

describe("2. a prepared student gets an open ask", () => {
  it("never 'haven't seen your edition'", () => {
    const q = decisionQuestion({ question: "Which leadership style do you want to argue works best here", basis: "general", options: [{ label: "Transformational", why: "x" }, { label: "Situational", why: "y" }] } as never, { prepared: true });
    expect(q).not.toMatch(/haven't seen your edition/);
    expect(q).toMatch(/You've done the reading/);
  });
});

describe("4. intro CHECK IT YOURSELF card", () => {
  it("never points an introduction at JSTOR", () => {
    const b = exampleLeadBatch({ concept: "which leadership style is most effective for leading a team through change", assignmentText: "", studentIdea: "Transformational leadership works best for change.", rubricRef: "r", section: { key: "intro", title: "Introduction" } });
    expect(b.candidates.map((c) => c.whyFits).join(" ")).not.toMatch(/JSTOR/);
  });
});

describe("5. Stage 3 coaching is grounded in their notes and pick", () => {
  it("intro without a claim names their pick and quotes them", () => {
    const g = outlineGap("Introduction", ["Change is hard for every team."], null, null, "Transformational");
    expect(g).toContain("transformational leadership");
    expect(g).toContain("“Change is hard for every team”");
  });
  it("body with an example ties it to their pick", () => {
    const g = outlineGap("Body", ["Barra kept the work going after the recall."], null, null, "Transformational");
    expect(g).toMatch(/Barra/);
    expect(g).toMatch(/transformational leadership/);
    expect(g).not.toMatch(/what reason or example backs it up/i);
  });
});

describe("6. the pre-confirm summary stays after the confirm", () => {
  it("renders the material panel under the last material turn in the history", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("i === lastMaterialTurn");
  });
});

describe("5b. a complete intro is still coached on their own lines", () => {
  it("quotes the claim and names the previewed example", () => {
    const g = outlineGap("Introduction", ["I think transformational leadership works best for change because people buy in.", "Satya Nadella is my example."], null, null, "Transformational");
    expect(g).toContain("“I think transformational leadership works best for change because people buy in”");
    expect(g).toContain("Satya Nadella");
  });
});
