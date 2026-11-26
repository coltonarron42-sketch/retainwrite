import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isExamplesAsk } from "@/lib/coach/effort";
import { knownExamplesFor, researchCloser } from "@/lib/coach/known-examples";
import { sourceTier } from "@/lib/coach/source-quality";
import { isBlockedSource } from "@/lib/coach/reading-sources";
import { readingLine } from "@/lib/coach/thinking-status";
import { SEARCH_EXCLUDED_DOMAINS } from "@/lib/ai/grok-research";
import { lastLineAsks } from "@/components/stages/loop/stance-chat";
import { pauTextSystem } from "@/lib/coach/pau-prompt";

describe("QA 7:00 #1: example requests go straight to research", () => {
  it("detects the asks", () => {
    expect(isExamplesAsk("Not transformational, just servant examples please.")).toBe(true);
    expect(isExamplesAsk("Real examples of transformational leadership")).toBe(true);
    expect(isExamplesAsk("Servant, not transformational, because Walton put associates first.")).toBe(false);
  });
  it("Stage 1 checks it before the story turn (no 'Mulling over…' first)", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    const fast = src.indexOf("isExamplesAsk(typed)");
    const story = src.indexOf("(await storyTurn(q, typed, sentBox))");
    expect(fast).toBeGreaterThan(0);
    expect(fast).toBeLessThan(story);
    const fast2 = src.indexOf("isExamplesAsk(fresh)");
    const story2 = src.indexOf('await storyTurn({ id: "stance_early"');
    expect(fast2).toBeGreaterThan(0);
    expect(fast2).toBeLessThan(story2);
  });
});

describe("QA 7:00 #2: essay mills and homework help", () => {
  it("are blocked (never read, never in a Reading line)", () => {
    for (const u of ["https://www.homeworkforyou.com/q/1", "https://www.studocu.com/x", "https://www.coursehero.com/x", "https://www.chegg.com/x", "https://www.essayshark.com/x", "https://www.studypool.com/x"]) {
      expect(sourceTier(u), u).toBe(0);
      expect(isBlockedSource(u), u).toBe(true);
      expect(readingLine(u), u).toBeNull();
    }
  });
  it("are excluded from the search itself (xAI: max 5)", () => {
    expect(SEARCH_EXCLUDED_DOMAINS).toContain("homeworkforyou.com");
    expect(SEARCH_EXCLUDED_DOMAINS.length).toBeLessThanOrEqual(5);
  });
  it("sophianetwork.net and babyboomer.org are weak", () => {
    expect(sourceTier("https://sophianetwork.net/x")).toBe(1);
    expect(sourceTier("https://www.babyboomer.org/x")).toBe(1);
  });
});

describe("QA 7:00 #3: broader queries, varied background", () => {
  it("the research prompt keeps their leader out of every query", () => {
    expect(pauTextSystem("research")).toMatch(/don't put the student's own leader's name into your queries/);
  });
  it("two fallback turns in one paper show different pairs", () => {
    const a = knownExamplesFor("servant", 0);
    const b = knownExamplesFor("servant", 1);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(a).not.toEqual(b);
    const t1 = knownExamplesFor("transformational", 0);
    const t2 = knownExamplesFor("transformational", 1);
    expect(t1.some((x) => t2.includes(x))).toBe(false);
  });
  it("skips names to avoid", () => {
    expect(knownExamplesFor("servant", 0, ["Herb Kelleher"]).join(" ")).not.toMatch(/Kelleher/);
  });
});

describe("QA 7:00 #4: one question only on research turns", () => {
  it("drops the recap of their pick", () => {
    const p = researchCloser(["• A did x (hbr.org).", "You picked servant leadership with Sam Walton already. Which do you like?"], "Sam Walton");
    expect(p.join(" ")).not.toMatch(/You picked/);
    expect(p.at(-1)).toBe("Does this fit your Sam Walton angle?");
  });
  it("a closer followed by the Sources line still counts as her last ask (no extra nudge)", () => {
    const t = [
      { k: "intro", who: "pau" as const, text: "• A did x." },
      { k: "intro", who: "pau" as const, text: "Which of these fits your paper best?" },
      { k: "intro", who: "pau" as const, text: "Sources: [x](https://hbr.org/x)" },
    ];
    expect(lastLineAsks(t as never, "intro")).toBe(true);
  });
});
