/** P3: stored sources placed per section, shown at the section's first prompt (Stages 2–3). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { placeSources, sourceHintLead, sourceHintsFor, storedSources } from "@/lib/coaching/source-hints";
import type { MaterialSummary } from "@/lib/stage1/paper-context";

const S = (kind: MaterialSummary["kind"], title: string, points: string[], url?: string): MaterialSummary => ({ kind, title, points, sources: url ? [{ title, url }] : [], at: 1 });
const GOLEMAN = S("found", "What Makes a Leader? (Goleman, HBR)", ["Emotional intelligence matters more than IQ for leaders.", "Five components: self-awareness, self-regulation, motivation, empathy, social skill.", "Empathy helps leaders keep talent during change."], "https://hbr.org/2004/01/what-makes-a-leader");
const NORTHOUSE = S("reading", "Northouse, Chapter 4", ["The behavioral approach looks at what leaders do: task and relationship behaviors.", "Servant leaders put followers' needs first."]);
const KNOW = S("knowledge", "Leadership styles", ["Transformational leaders inspire a shared vision."]);
const SECTIONS = [
  { key: "intro", title: "Introduction", needs: "Hook and thesis" },
  { key: "body1", title: "Body 1: Why servant leadership works", needs: "Explain servant leadership with the behavioral approach", concept: "servant leadership" },
  { key: "body2", title: "Body 2: Empathy during change", needs: "Show how emotional intelligence and empathy keep a team together through change" },
  { key: "conc", title: "Conclusion", needs: "Restate and close" },
];

describe("stored sources", () => {
  it("only their readings and pages Pau found (never her own knowledge), one per work, their copy first", () => {
    const list = storedSources([KNOW, GOLEMAN, NORTHOUSE, S("found", "Northouse, Chapter 4", ["x"])]);
    expect(list.map((x) => x.title)).toEqual(["What Makes a Leader? (Goleman, HBR)", "Northouse, Chapter 4"]);
    expect(list[1]!.kind).toBe("reading");
  });
  it("each source goes to the one section it fits best (where to reference it)", () => {
    const placed = placeSources(SECTIONS, [GOLEMAN, NORTHOUSE]);
    expect(placed.body2?.map((x) => x.title)).toEqual(["What Makes a Leader? (Goleman, HBR)"]);
    expect(placed.body1?.map((x) => x.title)).toEqual(["Northouse, Chapter 4"]);
    expect(placed.intro).toBeUndefined();
    expect(placed.conc).toBeUndefined();
  });
  it("a source that fits no section goes to the first body section, never the intro", () => {
    const placed = placeSources(SECTIONS, [S("reading", "Lecture notes", ["Week three overview."])]);
    expect(Object.keys(placed)).toEqual(["body1"]);
  });
  it("the hint carries the link, where it came from, and the two points that fit this section", () => {
    const h = sourceHintsFor(SECTIONS[2]!, SECTIONS, [GOLEMAN, NORTHOUSE]);
    expect(h).toHaveLength(1);
    expect(h[0]!.url).toBe("https://hbr.org/2004/01/what-makes-a-leader");
    expect(h[0]!.from).toBe("the source I found online");
    expect(h[0]!.points).toEqual(["Emotional intelligence matters more than IQ for leaders.", "Empathy helps leaders keep talent during change."]);
    expect(sourceHintsFor(SECTIONS[0]!, SECTIONS, [GOLEMAN, NORTHOUSE])).toEqual([]);
    expect(sourceHintsFor(SECTIONS[1]!, SECTIONS, [])).toEqual([]);
  });
  it("the lead says when and where, with no question", () => {
    expect(sourceHintLead(2, "Body 2: Empathy during change")).toMatch(/^Here's the source if you want to refresh before writing your body 2: empathy during change\. This is the section to reference it in\.$/);
    expect(sourceHintLead(3, "Body 1")).toMatch(/cite in your body 1/);
    expect(sourceHintLead(2, "x")).not.toContain("?");
  });
});

describe("wired into Stages 2 and 3 at the section's first prompt", () => {
  const stance = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
  const outline = readFileSync("components/stages/loop/outline-chat.tsx", "utf8");
  const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
  it("shown only before their first reply in that section", () => {
    expect(stance).toContain('!transcript.some((l) => l.who !== "pau" && l.k === section.key) ? (');
    expect(stance).toContain("<SourceHintCard stage={2}");
    expect(outline).toContain('!transcript.some((l) => l.who !== "pau" && l.k === current.key) ? (');
    expect(outline).toContain("<SourceHintCard stage={3}");
  });
  it("fed from the stored paper context (no new storage)", () => {
    expect(loop.match(/sources=\{pctx\?\.summaries \?\? \(pctx\?\.summary \? \[pctx\.summary\] : \[\]\)\}/g)?.length).toBe(2);
  });
});
