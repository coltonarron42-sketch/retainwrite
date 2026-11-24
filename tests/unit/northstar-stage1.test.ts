import { describe, expect, it } from "vitest";
import { stanceStartBlockers } from "@/lib/stage1/intake-resume";
import { isLostSaying, isPreparedSaying, overlapsTeaching, currentSummaries, summaryLabel, type PaperContext } from "@/lib/stage1/paper-context";
import { namedSources } from "@/lib/stage1/pau-pau";
import { isVagueNote, isContentQuestion } from "@/lib/coach/answer";
import { smartReadingAsk, MATERIAL_SOURCE_POLICY } from "@/lib/config/material-policy";
import type { AssignmentRequirements } from "@/lib/assignment/schema";

const base = { checklistConfirmed: true, hasStory: true, voiceOk: true, stanceOk: true };

describe("north-star Stage 1 gate (clarify, catch up, decide)", () => {
  it("blocks until catch-up and decision are done", () => {
    expect(stanceStartBlockers({ ...base, northstar: { catchUpDone: false, decided: false } })).toHaveLength(2);
    expect(stanceStartBlockers({ ...base, northstar: { catchUpDone: true, decided: false } })).toEqual(["Pick a direction and tell me why."]);
    expect(stanceStartBlockers({ ...base, northstar: { catchUpDone: true, decided: true } })).toEqual([]);
  });
  it("old papers keep the old gate", () => {
    expect(stanceStartBlockers(base)).toEqual([]);
  });
});

describe("student signals", () => {
  it("lost vs prepared", () => {
    expect(isLostSaying("I haven't read anything, no idea where to start")).toBe(true);
    expect(isLostSaying("idk what this is even about")).toBe(false);
    expect(isPreparedSaying("Yes, I read it last night")).toBe(true);
    expect(isPreparedSaying("I haven't read it")).toBe(false);
  });
  it("summary echoed back is not their answer", () => {
    const ctx: PaperContext = {
      v: 1,
      summaries: [{ kind: "knowledge", title: "Northouse Ch. 4", points: ["Leaders adapt their style to how ready and willing followers are to do the task at hand"], at: "x" } as never],
    };
    expect(overlapsTeaching("leaders adapt their style to how ready and willing followers are to do the task", ctx)).toBe(true);
    expect(overlapsTeaching("My coach at work always told us exactly what to do and I hated it", ctx)).toBe(false);
    expect(currentSummaries(ctx)).toHaveLength(1);
    expect(summaryLabel(currentSummaries(ctx)[0])).toMatch(/my own knowledge/);
  });
});

describe("named sources (Goleman no longer dropped)", () => {
  it("keeps both sources", () => {
    const req = {
      requiredSources: { value: { notes: 'Must include: Northouse, Leadership: Theory and Practice, Ch. 4; Goleman, "What Makes a Leader?" HBR 1998' } },
    } as unknown as AssignmentRequirements;
    const out = namedSources(req);
    expect(out).toHaveLength(2);
    expect(out.join(" ")).toMatch(/Goleman/);
  });
});

describe("coach answers", () => {
  it("vague notes get pushed, specific ones don't", () => {
    expect(isVagueNote("a good leader should be nice to people i guess")).toBe(true);
    expect(isVagueNote("My manager at Target let us pick shifts because she trusted us")).toBe(false);
  });
  it("content questions vs their idea", () => {
    expect(isContentQuestion("What is situational leadership?")).toBe(true);
    expect(isContentQuestion("Can you give me an example?")).toBe(true);
    expect(isContentQuestion("I think leaders should listen?")).toBe(false);
  });
});

describe("material policy", () => {
  it("is one switch, smart by default", () => {
    expect(MATERIAL_SOURCE_POLICY).toBe("smart");
  });
  it("offers an outbound seller link and never the dark web", () => {
    const ask = smartReadingAsk([{ title: "Northouse Ch. 4", known: true, offers: [{ seller: "Amazon", url: "https://www.amazon.com/x", price: "$79.99" }] }]) ?? "";
    expect(ask).toMatch(/\$79\.99/);
    expect(ask).toMatch(/dark web/);
    expect(smartReadingAsk([{ title: "Obscure memo", known: false, offers: [] }]) ?? "").toMatch(/photo|paste|link/);
  });
});
