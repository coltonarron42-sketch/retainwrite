import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { asLeader, groundedTwo, gutPickOf, narrowedTwo, pickEscalation } from "@/lib/stage1/north-turns";

// QA ethos should-fix (after #77): turns 2 and 3 are neutral; the narrow-to-two (turn 4) says why those two, and the chips match.
const OPTS = [
  { label: "Transformational", why: "Lets you show a leader selling a shared vision so people want the change." },
  { label: "Situational", why: "Lets you show a leader shifting style to fit how ready the team is." },
  { label: "Servant", why: "Lets you argue that putting people's needs first carries a team through change." },
];
const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const run = (said = "", n = 6) => {
  let last: string | null = null;
  const out: ReturnType<typeof pickEscalation>[] = [];
  for (let round = 1; round <= n; round++) {
    const e = pickEscalation({ options: OPTS, round, last, kind: "style", said });
    last = e.paras.join("\n");
    out.push(e);
  }
  return out;
};
const LEAN = /A lot of students|Simplest way in|start with|Want to start|easiest one|recommend|I'd go with|best bet/i;

describe("turns 2 and 3: plain definitions, one neutral question, no lean", () => {
  const out = run("not sure");
  it("turn 2 defines every option plainly and asks which sounds like a leader they know", () => {
    const t = out[1]!.paras;
    expect(t[0]).toBe("No problem. Here's the short version of each:");
    expect(t.filter((p) => p.startsWith("•"))).toEqual([
      "• Transformational: a leader selling a shared vision so people want the change.",
      "• Situational: a leader shifting style to fit how ready the team is.",
      "• Servant: a leader who puts the team's needs first so people come through the change together.",
    ]);
    expect(t.at(-1)).toBe("Which one sounds most like a leader you know?");
    expect(out[1]!.recommend).toBeNull();
  });
  it("turn 3 is one short open question with every option named equally", () => {
    expect(out[2]!.paras).toEqual(["Another way in, no wrong answer: which of these sounds closest to how you'd want to be led yourself: Transformational, Situational or Servant?"]);
    expect(out[2]!.recommend).toBeNull();
  });
  it("no turn leans on one style, recommends, or asks two questions", () => {
    for (const e of out) {
      const t = e.paras.join("\n");
      expect(t).not.toMatch(LEAN);
      expect(e.recommend).toBeNull();
      expect((t.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
  it("the gut pick waits for turn 4", () => {
    expect(narrowedTwo(out[1]!.paras.join("\n"))).toEqual([]);
    expect(narrowedTwo(out[2]!.paras.join("\n"))).toEqual([]);
    expect(narrowedTwo(out[3]!.paras.join("\n"))).toEqual(["Transformational", "Situational"]);
  });
  it("confused: taught plainly, still no recommendation", () => {
    const e = pickEscalation({ options: OPTS, round: 1, confused: true, kind: "style", concept: "Leaders guide people toward a goal." });
    expect(e.paras[0]).toMatch(/^That's okay, that's why you're here! Leaders guide people toward a goal\. Here's the short version of each:/);
    expect(e.recommend).toBeNull();
    expect(e.paras.join("\n")).not.toMatch(LEAN);
  });
});

describe("turn 4: the two offered, and why, from their own words", () => {
  it("nothing in their words points anywhere: the first two, and the third is still on the table", () => {
    const t = run("not sure")[3]!.paras;
    expect(t[0]).toBe("Let's narrow it to two. These two are a good place to start; Servant is still on the table if neither fits.");
    expect(t.at(-1)).toMatch(/^Which one feels closer, just going with your gut: Transformational or Situational\?/);
  });
  it("their words point at two: those two, with their phrase quoted", () => {
    const said = "not sure\nI guess a boss who listened to everyone\nhmm idk, maybe one with a big vision";
    const g = groundedTwo(OPTS, said);
    expect(g.two.map((o) => o.label)).toEqual(["Servant", "Transformational"]);
    const t = run(said)[3]!.paras;
    expect(t[0]).toMatch(/^Let's narrow it to two\. You said “[^”]*listened to everyone[^”]*”, so these two are the closest fit\.$/);
    expect(narrowedTwo(t.join("\n"))).toEqual(["Servant", "Transformational"]);
    expect(gutPickOf("Servant I think", ["Servant", "Transformational"])).toBe("Servant");
  });
  it("one hint: that one plus the next, still quoted from them (never an invented reason)", () => {
    const g = groundedTwo(OPTS, "not sure, my coach adapted to each player");
    expect(g.two.map((o) => o.label)).toEqual(["Situational", "Transformational"]);
    expect(g.quote).toMatch(/adapted/);
  });
  it("a style they set aside is not a reason to offer it", () => {
    const g = groundedTwo(OPTS, "not sure, but not servant");
    expect(g.quote).toBeNull();
    expect(g.two.map((o) => o.label)).toEqual(["Transformational", "Situational"]);
  });
  it("the chips show only the two after a narrowed turn", () => {
    expect(intake).toContain("narrowedTwo(lastProbe.current[q.id] ?? null)).map((o) => (");
    expect(intake).toContain("said: [materialAnswerNow, ...qaAsides.filter((x) => x.qid === q.id).map((x) => x.said), text].filter(Boolean).join(\"\\n\"),");
  });
  it("leaders keep their own path (unchanged)", () => {
    const people = [{ label: "Satya Nadella", why: "Led Microsoft's shift." }, { label: "Mary Barra", why: "Guided GM." }];
    const e = pickEscalation({ options: people, round: 2, kind: "leader" });
    expect(e.recommend).not.toBeNull();
  });
});

describe("QA 5:06 PM: one definition shape everywhere; turn 4 reads naturally", () => {
  const SHAPE = /^a leader (?:who\b|\w+ing\b)/;
  it("every leadership-style definition source reads 'a leader who…' / 'a leader [verb]ing…'", () => {
    const ctx = readFileSync("lib/stage1/paper-context.ts", "utf8");
    const block = ctx.slice(ctx.indexOf('question: "Which leadership style do you want to argue works best here"'));
    const opts = [...block.slice(0, block.indexOf("people:")).matchAll(/\{ label: "([^"]+)", why: "([^"]+)" \}/g)].map((m) => ({ label: m[1]!, why: m[2]! }));
    expect(opts.length).toBe(4);
    for (const o of opts) expect(asLeader(o.why, o.label)).toMatch(SHAPE);
    // A model-written line in another shape still gets the same form for a known style.
    for (const [label, why] of [["Servant", "Lets you argue that putting people's needs first carries a team through change."], ["Behavioral", "Lets you weigh getting the work done against caring for the people."], ["Democratic", "Shows how sharing decisions builds buy-in."], ["Transactional", "Rewards and consequences drive results."], ["Authentic", "Lets you argue that honesty earns trust."]]) {
      expect(asLeader(why!, label!)).toMatch(SHAPE);
    }
    // Not a leadership style: its own line, whole.
    expect(asLeader("Lets you argue for putting the hardest material first.", "Primacy effect")).toBe("lets you argue for putting the hardest material first");
  });
  it("turn 4 quoting the student: the whole turn, word for word, and the chips are those two", () => {
    const said = "not sure\nI guess a boss who listened to everyone\nhmm idk, maybe one with a big vision";
    const t = run(said)[3]!.paras;
    expect(t).toEqual([
      "Let's narrow it to two. You said “a boss who listened to everyone”, so these two are the closest fit.",
      "• Servant: a leader who puts the team's needs first so people come through the change together.",
      "• Transformational: a leader selling a shared vision so people want the change.",
      "Which one feels closer, just going with your gut: Servant or Transformational? Or if you'd rather look at the reading first, tap “Catch me up on the reading first”.",
    ]);
    expect(t.join("\n")).not.toMatch(/lets you/i);
    expect(narrowedTwo(t.join("\n"))).toEqual(["Servant", "Transformational"]);
  });
});
