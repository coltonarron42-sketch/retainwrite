/** QA ethos should-fix (after #74): on the 4th "not sure" Pau narrows to two and asks for a gut pick; never picks for them. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gutPickOf, narrowedTwo, pickEscalation } from "@/lib/stage1/north-turns";

const OPTS = [
  { label: "Transformational", why: "Lets you show a leader selling a shared vision so people want the change." },
  { label: "Situational", why: "Lets you show a leader shifting style to fit how ready the team is." },
  { label: "Servant", why: "Lets you argue that putting the team's needs first carries them through change." },
];
const run = (rounds: number, kind?: "style" | "leader") => {
  let last: string | null = null;
  const out: ReturnType<typeof pickEscalation>[] = [];
  for (let round = 1; round <= rounds; round++) {
    const e = pickEscalation({ options: OPTS, round, last, kind });
    last = e.paras.join("\n");
    out.push(e);
  }
  return out;
};

describe("4th 'not sure': narrow to two, gut pick, reading one tap away", () => {
  it("two styles, one plain line each, one gut-pick question, the reading offered", () => {
    const e = run(4)[3]!;
    const txt = e.paras.join("\n");
    expect(e.paras[0]).toBe("Let's narrow it to two. These two are a good place to start; Servant is still on the table if neither fits.");
    expect(e.paras.filter((p) => p.startsWith("•"))).toEqual([
      "• Transformational: lets you show a leader selling a shared vision so people want the change.",
      "• Situational: lets you show a leader shifting style to fit how ready the team is.",
    ].map((x) => expect.stringMatching(new RegExp(`^${x.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"))));
    expect(txt).toMatch(/going with your gut: Transformational or Situational\?/);
    expect(txt).toMatch(/Catch me up on the reading first/);
    expect((txt.match(/\?/g) ?? []).length).toBe(1);
    expect(e.offerCatchUp).toBe(true);
  });
  it("never auto-selects: no 'I'll pick', no 'Let's go with', no 'say ok', nothing to accept with a yes", () => {
    for (const e of run(8).slice(3)) {
      const txt = e.paras.join("\n");
      expect(txt).not.toMatch(/I'll pick|pick one for you|Let's go with|Say ok|Just say ok|for now/i);
      expect(e.recommend).toBeNull();
    }
  });
  it("later rounds: a different way in, then the two again in other words (never identical twice)", () => {
    const out = run(7).map((e) => e.paras.join("\n"));
    expect(out[4]).toMatch(/different side/);
    expect(out[5]).toMatch(/Down to two/);
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
  });
  it("a leader pick narrows the same way, without the reading button line", () => {
    const e = run(4, "leader")[3]!;
    expect(e.paras.join("\n")).not.toMatch(/Catch me up/);
    expect(e.recommend).toBeNull();
  });
});

describe("spark: the offer and 'No problem. Take your time.' are separate Past chat entries", () => {
  const src = readFileSync("components/stages/stage1/hesitation.tsx", "utf8");
  it("the offer and the reply are each their own part; the wrapper is not one merged part", () => {
    expect(src).toMatch(/<p className="text-ds-muted" data-chat-part data-spark-offer>/);
    expect(src).toMatch(/<p data-chat-part data-spark-reply>\{reply\}<\/p>/);
    expect(src).not.toMatch(/data-spark\n\s+data-chat-part/);
  });
});

describe("their gut pick after the narrowed turn is taken (live walk: 'Situational, my gut says…' had escalated)", () => {
  const last = run(4)[3]!.paras.join("\n");
  const two = narrowedTwo(last);
  it("reads the two from the narrowed turn", () => {
    expect(two).toEqual(["Transformational", "Situational"]);
    expect(narrowedTwo(run(6)[5]!.paras.join("\n"))).toEqual(["Transformational", "Situational"]);
    expect(narrowedTwo("Which one are you leaning toward?")).toEqual([]);
  });
  it("one of the two named, or the first/second one", () => {
    expect(gutPickOf("Situational, my gut says the leader has to adjust", two)).toBe("Situational");
    expect(gutPickOf("transformational i guess", two)).toBe("Transformational");
    expect(gutPickOf("the first one", two)).toBe("Transformational");
    expect(gutPickOf("second", two)).toBe("Situational");
  });
  it("never a guess: both, neither, or unsure is not a pick", () => {
    expect(gutPickOf("Transformational or Situational, idk", two)).toBeNull();
    expect(gutPickOf("not sure", two)).toBeNull();
    expect(gutPickOf("neither really", two)).toBeNull();
    expect(gutPickOf("ok", two)).toBeNull();
  });
  it("the intake takes it as their pick, in their words", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toMatch(/const two = narrowedTwo\(lastProbe\.current\[q\.id\] \?\? null\);[\s\S]{0,400}const gut = gutPickOf\(text, two\);[\s\S]{0,600}text = `I'd pick \$\{gut\}/);
    // Named it: kept exactly as typed (only "the first one" is spelled out).
    expect(src).toMatch(/if \(!new RegExp\(`\\\\b\$\{gut/);
  });
});
