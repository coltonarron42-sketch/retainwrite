import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignmentFocus, narrowedTwo, pickEscalation } from "@/lib/stage1/north-turns";

// QA should-fix (after #80): the narrow-to-two gives a real one-clause reason from the assignment, never invented.
const OPTS = [
  { label: "Transformational", why: "Lets you show a leader selling a shared vision so people want the change." },
  { label: "Situational", why: "Lets you show a leader shifting style to fit how ready the team is." },
  { label: "Servant", why: "Lets you show a leader who puts the team's needs first so people come through the change together." },
];
const PROMPT = "BUS 210: write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7.";
const turn4 = (focus: string | null, options = OPTS, said = "not sure") => {
  let last: string | null = null;
  let e = pickEscalation({ options, round: 1, kind: "style", said, focus });
  for (let round = 1; round <= 4; round++) {
    e = pickEscalation({ options, round, last, kind: "style", said, focus });
    last = e.paras.join("\n");
  }
  return e;
};
const LEAN = /A lot of students|Simplest way in|start with|Want to start|easiest one|recommend|I'd go with|best bet/i;

describe("assignmentFocus: only what the prompt literally says", () => {
  it("pulls the focus clause out of the parsed prompt", () => {
    expect(assignmentFocus(PROMPT)).toBe("leading a team through change");
    expect(assignmentFocus("which leadership style is most effective for leading a team through change")).toBe("leading a team through change");
    expect(assignmentFocus("Explain what role emotional intelligence plays in managing conflict at work.")).toBe("managing conflict at work");
  });
  it("no clear focus, or only a requirement: null (never invented)", () => {
    expect(assignmentFocus("Should high schools start later?")).toBeNull();
    expect(assignmentFocus("Write about leadership.")).toBeNull();
    expect(assignmentFocus("Pick a style for using APA citations correctly.")).toBeNull();
    expect(assignmentFocus("")).toBeNull();
    expect(assignmentFocus(null)).toBeNull();
  });
});

describe("turn 4: the reason comes from the assignment", () => {
  it("the QA prompt: one clause naming the prompt's focus, no style promoted, the rest on the table", () => {
    const e = turn4(PROMPT);
    expect(e.paras[0]).toBe("Let's narrow it to two. Your prompt is about leading a team through change, and either of these is a real way to argue it; Servant is still on the table if neither fits.");
    expect(e.paras.join("\n")).not.toMatch(LEAN);
    expect(e.recommend).toBeNull();
    expect(narrowedTwo(e.paras.join("\n"))).toEqual(["Transformational", "Situational"]);
  });
  it("when two definitions clearly speak to the focus and the third doesn't, those two, and it says so", () => {
    const opts = [
      { label: "Transactional", why: "Lets you show a leader trading clear rewards for results." },
      { label: "Situational", why: "Lets you show a leader shifting style to fit how ready the team is for change." },
      { label: "Servant", why: "Lets you show a leader who puts the team's needs first so people come through the change together." },
    ];
    const e = turn4(PROMPT, opts);
    expect(e.paras[0]).toBe("Let's narrow it to two. Since your prompt is about leading a team through change, these two speak to that most directly; Transactional is still on the table if neither fits.");
    expect(narrowedTwo(e.paras.join("\n"))).toEqual(["Situational", "Servant"]);
  });
  it("nothing usable in the prompt: the neutral line stays", () => {
    expect(turn4("Should high schools start later?").paras[0]).toBe("Let's narrow it to two. These two are a good place to start; Servant is still on the table if neither fits.");
    expect(turn4(null).paras[0]).toBe("Let's narrow it to two. These two are a good place to start; Servant is still on the table if neither fits.");
  });
  it("their own words still win over the prompt", () => {
    const e = turn4(PROMPT, OPTS, "not sure\nI guess a boss who listened to everyone\nhmm idk, maybe one with a big vision");
    expect(e.paras[0]).toBe("Let's narrow it to two. You said “a boss who listened to everyone”, so these two are the closest fit.");
  });
  it("turns 2 and 3 never carry the reason (still neutral)", () => {
    let last: string | null = null;
    for (let round = 1; round <= 3; round++) {
      const e = pickEscalation({ options: OPTS, round, last, kind: "style", said: "not sure", focus: PROMPT });
      last = e.paras.join("\n");
      expect(last).not.toMatch(/Your prompt is about|Since your prompt/);
      expect(last).not.toMatch(LEAN);
    }
  });
  it("the intake passes the parsed assignment focus", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("focus: requirements?.promptQuestion.value || requirements?.topic.value || null,");
  });
});
