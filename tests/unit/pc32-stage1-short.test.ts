import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GHOST_FIELD,
  containsGhost,
  ghostGuidance,
  ghostLeakCheck,
  ghostLogDetail,
  isServerOnlyField,
  openGhost,
  assembleGhost,
  ghostTargets,
  parseGhostPlan,
  parseSection,
  sectionsToFix,
  sectionCeil,
  withBudgets,
  wordsIn,
  sealGhost,
  type GhostScript,
} from "@/lib/ghost/script";
import {
  IDEAS_CHECK_ASK,
  IDEAS_CHECK_ID,
  MAX_IDEA_TURNS,
  classifyStartingPoint,
  hasIdea,
  ideaStepId,
  ideasAck,
  ideasPlan,
  ideasSaid,
  isDoneSaying,
  stage2StartingLine,
  type IdeaStep,
} from "@/lib/stage1/starting-point";
import { groundedGraded } from "@/lib/stage1/readback-tidy";
import { shortStage1Checklist } from "@/lib/stage1/intake-resume";
import { paperContextBlock } from "@/lib/stage1/paper-context";

const src = (p: string) => readFileSync(p, "utf8");
const SECRET = "test-secret-not-real-0123456789abcdef";

const PAPER = Array.from({ length: 30 }, (_, i) =>
  i === 3
    ? "Servant leadership succeeds during organizational change because it builds the trust that employees need before they accept uncertainty."
    : `Paragraph sentence number ${i} explains how a manager at a regional hospital rebuilt morale after a merger by meeting each nurse individually.`,
).join(" ");
const GHOST: GhostScript = {
  v: 1,
  inputHash: "h",
  thesis: "Servant leadership succeeds during organizational change because it builds the trust that employees need before they accept uncertainty.",
  outline: [{ section: "Body 1", points: ["trust before change", "hospital merger example"] }],
  paper: PAPER,
  sources: [{ title: "Greenleaf Center", url: "https://www.greenleaf.org" }],
  startingKind: "no_clue",
  at: 1,
  searches: 2,
};

describe("PC-32 ghost script: server-only, never serialized (Colton t221u)", () => {
  it("is sealed with AES-GCM: no plaintext in the stored value, opens only with the server secret", () => {
    const sealed = sealGhost(GHOST, SECRET);
    expect(sealed.startsWith("rwg1:")).toBe(true);
    expect(sealed).not.toContain("Servant");
    expect(sealed).not.toContain("hospital");
    expect(openGhost(sealed, SECRET)).toEqual(GHOST);
    expect(openGhost(sealed, "another-secret-entirely-0123456789")).toBeNull();
    expect(openGhost(sealed.slice(0, -4) + "AAAA", SECRET)).toBeNull();
    expect(openGhost(null, SECRET)).toBeNull();
  });
  it("lives under a reserved server-only key that the autosave API never returns and never accepts", () => {
    expect(GHOST_FIELD).toBe("server:ghost_script");
    expect(isServerOnlyField(GHOST_FIELD)).toBe(true);
    expect(isServerOnlyField("loop_session")).toBe(false);
    const route = src("app/api/papers/[paperId]/autosave/route.ts");
    expect(route).toContain('.filter((row) => row.field_key !== "loop_session" && !isServerOnlyField(row.field_key))');
    expect(route).toContain('if (isServerOnlyField(body.fieldKey)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });');
  });
  it("the autosave GET filter drops the ghost row from what the browser gets", () => {
    const rows = [
      { field_key: "stage1:ideas_check", draft_text: "x" },
      { field_key: GHOST_FIELD, draft_text: sealGhost(GHOST, SECRET) },
      { field_key: "loop_session", draft_text: "{}" },
    ];
    const out = rows.filter((row) => row.field_key !== "loop_session" && !isServerOnlyField(row.field_key));
    expect(out.map((r) => r.field_key)).toEqual(["stage1:ideas_check"]);
    expect(containsGhost({ drafts: out }, GHOST)).toBe(false);
    expect(containsGhost({ drafts: rows }, GHOST)).toBe(true);
  });
  it("is not in the paper context, the brief's public view, the prompt context block, or any client code", () => {
    expect(src("lib/stage1/paper-context.ts")).not.toMatch(/\bghost\w*\s*\??:/);
    const brief = src("app/api/papers/[paperId]/intake/brief/route.ts");
    expect(brief).not.toMatch(/ghost/i);
    const block = paperContextBlock({ v: 1, northstar: true, startingPoint: { kind: "no_clue", readMaterial: false, at: 1 } });
    expect(containsGhost(block, GHOST)).toBe(false);
    // No client component, page or hook imports the ghost modules.
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
      });
    for (const f of [...walk("components"), ...walk("app").filter((p) => !p.includes("/api/"))]) {
      expect(src(f), f).not.toMatch(/lib\/(server\/)?ghost/);
    }
    // Only these server files read it.
    const readers = walk("app").filter((f) => /lib\/server\/ghost\/store/.test(src(f)));
    // t227u: the fit check reads only its research titles (its words come from a fixed table).
    expect(readers.sort()).toEqual(["app/api/papers/[paperId]/coach/answer/route.ts", "app/api/papers/[paperId]/coach/fit/route.ts", "app/api/papers/[paperId]/intake/complete/route.ts"]);
  });
  it("routes that touch it return only coaching output or flow data (no ghost variables in any response)", () => {
    const coach = src("app/api/papers/[paperId]/coach/answer/route.ts");
    expect(coach).toContain("return NextResponse.json({ paras });");
    expect(coach).not.toMatch(/NextResponse\.json\([^)]*ghost/);
    const complete = src("app/api/papers/[paperId]/intake/complete/route.ts");
    expect(complete).not.toMatch(/NextResponse\.json\([^)]*ghost/i);
    expect(complete).toContain("after(async () => {");
    const store = src("lib/server/ghost/store.ts");
    expect(store).toContain('import "server-only";');
    // Logs are counts only.
    for (const line of store.split("\n").filter((l) => /console\./.test(l))) expect(line.replace("ghostLogDetail(ghost)", "")).not.toMatch(/\.paper\b|\.thesis\b|ghost\)|\binput\b/);
    const detail = JSON.stringify(ghostLogDetail(GHOST));
    expect(containsGhost(detail, GHOST)).toBe(false);
    expect(detail).not.toContain("hospital");
  });
  it("hidden guidance carries structure only: no thesis and no paper sentences", () => {
    const g = ghostGuidance(GHOST);
    expect(containsGhost(g, GHOST)).toBe(false);
    expect(g).toMatch(/Never quote, paraphrase/);
    expect(g).not.toContain(GHOST.thesis.slice(0, 40));
  });
  it("the output gate blocks 5-word overlap and near-copies, but not the student's own words or plain coaching", () => {
    expect(ghostLeakCheck("Here's a thought: it builds the trust that employees need before change.", GHOST).ok).toBe(false);
    expect(
      ghostLeakCheck("Servant leadership succeeds in organizational change since it builds trust employees need before accepting uncertainty.", GHOST).ok,
    ).toBe(false);
    expect(ghostLeakCheck("What's one moment when a boss earned your trust? That could be a great example.", GHOST).ok).toBe(true);
    const student = "I think it builds the trust that employees need";
    expect(ghostLeakCheck("You said it builds the trust that employees need. Nice.", GHOST, student).ok).toBe(true);
    expect(src("app/api/papers/[paperId]/coach/answer/route.ts")).toMatch(/if \(paras\.some\(\(p\) => !ghostLeakCheck\(p, ghost, allowed\)\.ok\)\) \{\s*paras = \[\];/);
  });
  it("targets the instructor's word range (words, pages, estimate, default)", () => {
    expect(ghostTargets({ wordsMin: 1200, wordsMax: 1500 })).toEqual({ min: 1200, max: 1500 });
    expect(ghostTargets({ pagesMin: 4, pagesMax: 5 })).toEqual({ min: 1100, max: 1375 });
    expect(ghostTargets({ wordsEstimateMin: 900, wordsEstimateMax: 1100 })).toEqual({ min: 900, max: 1100 });
    expect(ghostTargets({ wordsMax: 1000 })).toEqual({ min: 850, max: 1000 });
    expect(ghostTargets(null)).toEqual({ min: 1000, max: 1200 });
  });
  it("plans section budgets that add up to the middle of the range, with real URLs only", () => {
    const plan = parseGhostPlan(
      "```json\n" + JSON.stringify({ thesis: "t", outline: [{ section: "Intro", points: ["a"], words: 100 }, { section: "Body", points: ["b"], words: 300 }, { section: "End", points: ["c"], words: 100 }], sources: [{ title: "x", url: "nope" }, { title: "y", url: "https://y.org" }], notes: ["n"] }) + "\n```",
      { targetMin: 1200, targetMax: 1500 },
    );
    expect(plan?.outline.map((x) => x.words)).toEqual([270, 810, 270]);
    expect(plan?.sources).toEqual([{ title: "y", url: "https://y.org" }]);
    expect(parseGhostPlan('{"thesis":"t","outline":[{"section":"a","points":[]}]}', { targetMin: 1, targetMax: 2 })).toBeNull();
    expect(withBudgets([{ words: 0 }, { words: 0 }], 1000, 1200).map((x) => x.words)).toEqual([550, 550]);
  });
  it("rewrites sections in proportion until the total is in range; never stores a short or overlong paper", () => {
    const w = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    expect(sectionsToFix([300, 600, 300], [w(300), w(600), w(300)], 1100, 1300)).toEqual([]);
    const short = sectionsToFix([300, 600, 300], [w(300), w(300), w(300)], 1100, 1300);
    expect(short.map((x) => x.i)).toEqual([0, 1, 2]);
    expect(short.reduce((a, x) => a + x.target, 0)).toBeGreaterThanOrEqual(1200);
    expect(short[1]!.target).toBeGreaterThan(short[0]!.target);
    const long = sectionsToFix([300, 600, 300], [w(500), w(900), w(300)], 1100, 1300);
    expect(long.reduce((a, x) => a + x.target, 0)).toBeGreaterThanOrEqual(1100);
    expect(long.reduce((a, x) => a + x.target, 0)).toBeLessThanOrEqual(1300);
    // 1156 of 1200-1500 (the 4:17 PM walk) is not good enough any more.
    expect(sectionsToFix([450, 450, 450], [w(400), w(380), w(376)], 1200, 1500).length).toBe(3);
    expect(sectionCeil(500)).toBe(550);
    const plan = { thesis: "t", outline: [{ section: "a", points: [], words: 600 }], sources: [], notes: [] };
    const meta = { inputHash: "h", startingKind: "no_clue", searches: 3, targetMin: 1200, targetMax: 1500 };
    expect(assembleGhost(plan, [w(659)], meta)).toBeNull();
    expect(assembleGhost(plan, [w(600), w(556)], meta)).toBeNull();
    expect(assembleGhost(plan, [w(900), w(700)], meta)).toBeNull();
    const g = assembleGhost(plan, [w(700), w(600)], meta);
    expect(wordsIn(g!.paper)).toBe(1300);
    expect(g?.targetMin).toBe(1200);
    expect(parseSection('{"text":"too short"}')).toBeNull();
  });
  it("searches only in the plan step (≤3); sections are written without tools", () => {
    const store = src("lib/server/ghost/store.ts");
    expect(store.match(/type: "web_search" \}/g)?.length).toBe(1);
    expect(store).toContain("max_turns: GHOST_MAX_TURNS");
    expect(store).toContain("export const GHOST_MAX_TURNS = 3;");
  });
});

describe("PC-32 short Stage 1: starting point (Colton t221u)", () => {
  it("classifies has ideas / read the material / no clue", () => {
    expect(classifyStartingPoint({ ideas: "I want to write about my soccer coach and how he kept us together" }).kind).toBe("has_ideas");
    expect(classifyStartingPoint({ ideas: "I read the chapter but no idea yet" }).kind).toBe("read_material");
    expect(classifyStartingPoint({ ideas: "nope" }).kind).toBe("no_clue");
    expect(classifyStartingPoint({ ideas: "" }).kind).toBe("no_clue");
    expect(classifyStartingPoint({ ideas: "I read it but no idea", lostAtStart: true }).kind).toBe("no_clue");
    for (const no of ["no", "idk", "not yet", "no idea", "nothing yet", "I don't know"]) expect(hasIdea(no), no).toBe(false);
  });
  it("nothing given still advances: the checklist never blocks on an idea", () => {
    const items = shortStage1Checklist({ confirmed: true, kind: "no_clue" });
    expect(items.every((i) => i.done)).toBe(true);
    expect(items[1]!.label).toMatch(/fresh \(totally fine\)/);
    expect(ideasAck({ kind: "no_clue" })).toMatch(/Totally fine/);
  });
  it("Stage 2 meets them where they are", () => {
    expect(stage2StartingLine({ kind: "has_ideas", ideas: "I'm thinking about my manager at work", readMaterial: false, at: 1 })).toBe(
      "In Stage 1 you said you're thinking about your manager at work. We'll start there.",
    );
    expect(stage2StartingLine({ kind: "no_clue", readMaterial: false, at: 1 })).toMatch(/fine place to start/);
    expect(src("components/stages/loop/coaching-loop.tsx")).toContain("?? stage2StartingLine(pctx?.startingPoint)");
    const block = paperContextBlock({ v: 1, startingPoint: { kind: "has_ideas", ideas: "my coach", readMaterial: false, at: 1 } });
    expect(block).toContain('they already have an idea, in their words: "my coach"');
  });
  it("the server's north-star gate is the confirmed read-back only; the old steps are retired from the Stage 1 plan", () => {
    const route = src("app/api/papers/[paperId]/intake/complete/route.ts");
    expect(route).toContain("if (pctx.readback && !pctx.readback.confirmed)");
    expect(route).toContain("startingPoint: point");
    const intake = src("components/stages/stage1/assignment-intake.tsx");
    for (const id of ["material_check", "decision_pick", "decision_why", "leader_pick"]) expect(intake).not.toContain(`id: "${id}",`);
    expect(intake).toContain("for (const step of ideasPlan(answers)) plan.push(");
    expect(intake).toContain("Boolean(hesitationKey) && !shortStage1"); // no spark offer in the short Stage 1
  });
});

/* ------------- Colton t222u: keep it light, never an interview ------------- */
const PROBE = /\b(why|what (?:got|made|makes)|how come|tell me more|say more|explain|what about|how would|go deeper|elaborate)\b/i;
const say = (steps: IdeaStep[], replies: string[]) => {
  const answers = [] as { questionId: string; questionText: string; answerText: string }[];
  let plan = ideasPlan(answers);
  for (const r of replies) {
    const open = plan.find((s) => !answers.some((a) => a.questionId === s.id));
    if (!open) break;
    answers.push({ questionId: open.id, questionText: open.text, answerText: r });
    plan = ideasPlan(answers);
  }
  steps.push(...plan);
  return { plan, answers };
};

describe("PC-32 Stage 1 ideas: acknowledge, summarize back, note, move on (Colton t222u)", () => {
  it("the first ask is light and says nothing is fine", () => {
    expect(ideasPlan([])).toEqual([{ id: IDEAS_CHECK_ID, kind: "ask", text: IDEAS_CHECK_ASK }]);
    expect(IDEAS_CHECK_ASK).toMatch(/totally fine/);
  });
  it("no idea → no follow-up at all", () => {
    for (const r of ["no", "idk", "not really", "nothing yet"]) expect(say([], [r]).plan).toHaveLength(1);
  });
  it("an idea → summarized back for confirmation (no probe); yes → done", () => {
    const { plan } = say([], ["I want to write about my old soccer coach and how he kept the team together after we lost our captain", "yes"]);
    expect(plan.map((s) => s.kind)).toEqual(["ask", "confirm"]);
    expect(plan[1]!.text).toMatch(/^Ooh, I like that\. So you're thinking: your old soccer coach/);
    expect(plan[1]!.text).toMatch(/Did I get that right\?$/);
    expect(plan[1]!.text).not.toMatch(PROBE);
  });
  it("only an unclear idea gets ONE light clarifying question, then a confirmation", () => {
    const { plan } = say([], ["maybe sports", "how my coach handled losing", "yep"]);
    expect(plan.map((s) => s.kind)).toEqual(["ask", "clarify", "confirm"]);
    expect(plan[2]!.text).toMatch(/Did I get that right\?$/);
  });
  it("wanting to expand: listen, acknowledge, summarize, note, until they say that's it (capped)", () => {
    const { plan } = say([], [
      "I want to write about my manager at the grocery store who always covered shifts for us",
      "also she trained every new hire herself, even on weekends",
      "and she remembered everyone's birthdays which made us want to work harder",
      "that's it for now",
    ]);
    expect(plan.map((s) => s.kind)).toEqual(["ask", "confirm", "confirm", "confirm"]);
    expect(plan[2]!.text).toMatch(/^Got it, I noted that too: also she trained every new hire herself/);
    expect(plan.length).toBeLessThanOrEqual(1 + MAX_IDEA_TURNS);
    const long = say([], ["I want to write about my coach and the way she ran practice", ...Array.from({ length: 10 }, (_, i) => `more detail number ${i} about practice drills and teamwork`)]);
    expect(long.plan.length).toBe(1 + MAX_IDEA_TURNS);
  });
  it("never asks consecutive probing questions, and at most one clarifying question, on any reply sequence", () => {
    const pool = ["yes", "no", "that's it", "maybe sports", "kind of something about leadership", "I want to write about my aunt who runs a bakery and leads with patience", "also the morning rush", "idk", "sure", "and she trusts new staff early", "nope that's all"];
    let seed = 7;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let run = 0; run < 300; run++) {
      const replies = Array.from({ length: 6 }, () => pool[Math.floor(rnd() * pool.length)]!);
      const { plan } = say([], replies);
      const follow = plan.slice(1);
      expect(follow.filter((s) => s.kind === "clarify").length, replies.join(" | ")).toBeLessThanOrEqual(1);
      for (let i = 1; i < follow.length; i++) expect(follow[i]!.kind === "clarify" && follow[i - 1]!.kind === "clarify").toBe(false);
      if (follow.length) expect(follow[0]!.kind === "clarify" || follow.every((s) => s.kind === "confirm")).toBe(true);
      for (const s of follow.filter((x) => x.kind === "confirm")) expect(s.text, s.text).not.toMatch(PROBE);
      expect(plan.length).toBeLessThanOrEqual(1 + MAX_IDEA_TURNS);
    }
  });
  it("done-sayings end it; real additions keep listening", () => {
    for (const d of ["yes", "yep that's right", "that's it", "that's all for now", "sounds right", "no, that's everything"]) expect(isDoneSaying(d), d).toBe(true);
    expect(isDoneSaying("also she trained every new hire herself")).toBe(false);
  });
  it("what they said is saved in their words for Stage 2 (done-sayings dropped)", () => {
    const { answers } = say([], ["I want to write about my manager at the grocery store", "also she covered shifts", "that's it"]);
    expect(ideasSaid(answers)).toEqual({ ideas: "I want to write about my manager at the grocery store", followUp: "also she covered shifts" });
    expect(ideaStepId(1)).toBe("ideas_follow");
  });
  it("the voice persona keeps Stage 1 light and never an interview", () => {
    const persona = src("lib/voice/realtime/persona.ts");
    expect(persona).toMatch(/Keep it light: this is never an interview/);
    expect(persona).toMatch(/no probing, no "why" chains/);
  });
});

describe("QA Nov 25 (main): read-back facts only", () => {
  it("(a) never invents grading criteria", () => {
    const sheet = "Write a 1,200 word essay arguing which leadership style works best. Use two sources. MLA format.";
    expect(groundedGraded(["length", "how well it argues"], sheet, false)).toEqual([]);
    const rubric = "Rubric: Thesis clarity (20 pts); Use of evidence (30 pts); Organization (20 pts).";
    expect(groundedGraded(["thesis clarity", "use of evidence", "creativity and voice"], rubric, true)).toEqual(["thesis clarity", "use of evidence"]);
    expect(src("lib/server/paper-context/brief.ts")).toContain("graded: groundedGraded(");
  });
  it("(b) never assumes the due-date year", () => {
    expect(src("lib/stage1/pau-pau.ts")).not.toContain("withYear(");
    expect(src("lib/stage1/confirm-reply.ts")).not.toContain("withYear(");
  });
  it("(c) a second style chip replaces an untouched chip prefill", () => {
    expect(src("components/stages/stage1/assignment-intake.tsx")).toContain("/^I'd pick [^.]{1,60} because\\s*$/.test(d) ? `I'd pick ${o.label} because ` : d");
  });
});
