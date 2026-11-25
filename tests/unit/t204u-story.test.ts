import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isRichStory, proposalReply, reflectParas, reflectStory, storyWho } from "@/lib/stage1/story-reflect";
import { COACH_ANSWER_SYSTEM } from "@/lib/coach/answer";

// t204u: Colton's live test (his story, paraphrased from the report; the screenshots stay with the parent).
const MANDY =
  "When I worked at T-Mobile, my manager Mandy held weekly one-on-ones with every rep on the team. She coached people toward promotions and covered our shifts herself when we were short. Half of our store got promoted while she was there. She was truly a servant leader.";
const asks = (paras: string[]) => (paras.join(" ").match(/\?/g) ?? []).length;

describe("t204u (a): a named style plus a concrete story is reflected back, with ONE next move", () => {
  it("names the link in plain words and proposes one direction with an easy yes", () => {
    expect(isRichStory(MANDY)).toBe(true);
    expect(storyWho(MANDY)?.who).toBe("Mandy");
    const r = reflectStory(MANDY)!;
    expect(r.style).toBe("servant");
    const paras = reflectParas(r);
    expect(paras[0]).toMatch(/^Mandy held weekly one-on-ones with every rep and coached people toward promotions\. That's classic servant leadership/);
    expect(paras[1]).toMatch(/servant leadership, with Mandy as your proof\..*Want to run with it\?$/);
    expect(asks(paras)).toBe(1);
    expect(paras.join(" ")).not.toMatch(/Here are a few directions|Which direction|\n\d\.|•/);
  });
  it("never invents a style for a story that didn't name one unless asked to build on it (tentative)", () => {
    const plain = MANDY.replace(" She was truly a servant leader.", " I still think about how she ran that store.");
    expect(reflectStory(plain)).toBeNull();
    const t = reflectStory(plain, { tentative: true })!;
    expect(t.style).toBe("servant");
    expect(reflectParas(t)[1]).toMatch(/^Here's a direction to try: .*Want to run with it\?$/);
  });
});

describe("t204u (b)/(c): his follow-ups", () => {
  it("reads each follow-up", () => {
    expect(proposalReply("I don't understand. Can you build on my Mandy story and connect it to servant leadership?")).toBe("confused");
    expect(proposalReply("you said you'd interview me")).toBe("interview");
    expect(proposalReply("Can you summarize the readings? I haven't read them.")).toBe("summary");
    expect(proposalReply("Yes, let's run with it")).toBe("yes");
  });
  it("the intake routes them: proposal first, interview one question at a time, catch-up tied back", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("(await storyTurn(q, typed, sentBox))) return;");
    expect(src).toMatch(/await storyTurn\(\{ id: "stance_early"/);
    expect(src).toContain("push(typed, storySummaryParas(list, r), true, id);");
    expect(src).toContain('q.kind !== "interest" && catchUpOffer !== q.id && (await storyTurn(q, typed, sentBox))');
    // One ask per turn: the plan's question is off screen while her story reply is the open ask.
    expect(src).toContain('{q && !(decisionSaving && q.id === "decision_pick") && !storyAsk && !asideQ ? (');
    // Yes: the story is their answer, decision and early take; no "early take" ask, no "Which direction…?".
    expect(src).toMatch(/async function runWithStory[\s\S]{0,3000}stage1:stance_early[\s\S]{0,2000}setStoryFromDecision\(true\)[\s\S]{0,400}setScreen\("gate"\)/);
    expect(COACH_ANSWER_SYSTEM).toMatch(/mode "interview".*exactly ONE short question/);
  });
});
