/**
 * QA 12:48: Colton's exact words from his production test (verbatim, fillers and typos included).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import c from "../fixtures/colton-t204u-exact.json";
import { isRichStory, proposalReply, reflectParas, reflectStory, storySummaryParas, storyWho, withoutSpokenFiller } from "@/lib/stage1/story-reflect";

const asks = (paras: string[]) => (paras.join(" ").match(/\?/g) ?? []).length;

describe("t204u exact: his Mandy answer", () => {
  it("is a story about Mandy, with servant named by him (fillers and 'in working for' don't matter)", () => {
    expect(isRichStory(c.story)).toBe(true);
    expect(storyWho(c.story)).toEqual({ who: "Mandy", named: true });
    const r = reflectStory(c.story)!;
    expect(r.style).toBe("servant");
    expect(r.tentative).toBe(false);
    expect(withoutSpokenFiller(c.story)).not.toMatch(/\buh\b/i);
  });
  it("is never read as a yes because it opens with 'Okay, so…'", () => {
    expect(proposalReply(c.story)).not.toBe("yes");
  });
  it("is reflected with the link named, then ONE easy-yes ask", () => {
    const paras = reflectParas(reflectStory(c.story)!);
    const all = paras.join(" ");
    expect(all).toMatch(/^Mandy took everybody's time and requests seriously and gave people tasks/);
    expect(all).toContain("That's classic servant leadership");
    expect(all).toContain("servant leadership, with Mandy as your proof");
    expect(asks(paras)).toBe(1);
    expect(all).not.toMatch(/\b1\)|Transformational|Situational|Which leadership style/);
  });
});

describe("t204u exact: his follow-ups", () => {
  it("'…Maybe we set an interview to, to dig deeper…' is the interview he asked for", () => {
    expect(proposalReply(c.follow)).toBe("interview");
  });
  it("'Can you summarize, uh, the content…' is the summary request", () => {
    expect(proposalReply(c.summary)).toBe("summary");
  });
  it("after the interview, his named style wins over a guess from 'one-on-ones' (never Behavioral)", () => {
    const story = [c.story, "Once I needed a week off and Mandy rearranged the schedule herself.", "Her one-on-ones every week were where she asked what we wanted next and then gave us real tasks toward that."].join("\n");
    expect(reflectStory(story)?.style).toBe("servant");
  });
});

describe("QA 12:48 (a): the summary tied to his story", () => {
  const sum = (title: string) => ({ kind: "knowledge", title, points: ["One.", "Two.", "Three.", "Four.", "Five."] });
  it("3–5 bullets in total, labeled general background, tied to Mandy, at most one ask", () => {
    const paras = storySummaryParas([sum("Northouse"), sum("Goleman")], reflectStory(c.story));
    const bullets = paras.filter((p) => p.startsWith("•"));
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets.length).toBeLessThanOrEqual(5);
    expect(paras.join(" ")).toMatch(/general background, not from your chapters/);
    expect(paras.join(" ")).toContain("Mandy is the servant idea in action");
    expect(asks(paras)).toBeLessThanOrEqual(1);
    expect(paras.join(" ")).not.toMatch(/\b(?:p\.|page)\s*\d/i);
  });
  it("with no summaries loaded it still teaches 3 plain general bullets", () => {
    const paras = storySummaryParas([], reflectStory(c.story));
    expect(paras.filter((p) => p.startsWith("•")).length).toBe(3);
  });
});

describe("QA 12:48 #3: one ask per turn at the render layer", () => {
  const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
  it("once she replied in place, the plan's question isn't re-asked under it and no spark offer joins", () => {
    expect(src).toContain("const asideQ = Boolean(q && !editing && qAsidesNow.length > 0);");
    expect(src).toContain("const sparkHere = q && sparks[q.id] && !asideQ ?");
    expect(src).toContain("{q && asideQ ? <PauPauGroup bubbles={askedAs.current[q.id] ?? [q.text]} /> : null}");
    expect(src).toContain("data-ask-chips");
  });
  it("the first interview question is instant and says the name", () => {
    expect(src).toContain("if (n === 0) return fallback;");
    expect(src).toMatch(/What's one moment with \$\{who \?\? "them"\} that stuck with you\?/);
  });
});
