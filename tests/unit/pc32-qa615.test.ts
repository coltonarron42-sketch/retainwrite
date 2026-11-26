import { describe, expect, it } from "vitest";
import {
  BACKGROUND_LABEL,
  cleanLeaderFact,
  fittingQuestion,
  noFactsReply,
  readingCatalog,
  shapeStructuredAnswer,
  THESIS_FOR_THEM,
} from "@/lib/coach/answer";
import { isWriteRequest, writeRequestReply } from "@/lib/stages/stance-intent";

// QA paper A (2d4db14a): BUS 210, Northouse ch. 4 + Goleman HBR, both summarized from her knowledge.
const ctx = {
  readback: {
    mustInclude: ["Chapter 4 of Northouse, Leadership: Theory and Practice", "HBR article 'What Makes a Leader?' by Daniel Goleman", "one real leader as your example"],
  },
  summaries: [
    {
      kind: "knowledge",
      title: "Northouse's Leadership: Theory and Practice (the book overall)",
      points: [
        "Northouse treats leadership as a process of influencing a group toward a shared goal.",
        "The book surveys the major approaches: trait and skills, behavioral (task vs. relationship), situational, transformational, servant and authentic leadership.",
      ],
    },
    {
      kind: "knowledge",
      title: "Goleman's “What Makes a Leader?”",
      points: [
        "Goleman argues that emotional intelligence is what sets the most effective leaders apart.",
        "He names five components: self-awareness, self-regulation, motivation, empathy, and social skill.",
      ],
    },
  ],
  missing: ["Northouse's Leadership: Theory and Practice, Ch. 4", "Goleman's “What Makes a Leader?”"],
};
const readings = readingCatalog(ctx);
const goleman = readings.find((r) => r.author === "Goleman")!;
const northouse = readings.find((r) => r.author === "Northouse")!;
const WALTON_Q = "How did Sam Walton show servant leadership?";

describe("QA 6:15 PM: reading catalog", () => {
  it("one entry per assigned reading, with ids, authors and nouns", () => {
    expect(readings).toHaveLength(2);
    expect(goleman.noun).toBe("article");
    expect(northouse.noun).toBe("chapter");
    expect(goleman.id).toMatch(/^r\d$/);
  });
});

describe("QA 6:15 PM: Walton HOW gives 2+ leader facts with no author in them", () => {
  const raw = {
    explain: "",
    readingPoints: [],
    leaderFacts: [
      "Sam Walton visited hundreds of stores a year and asked associates what customers wanted.",
      "He started profit sharing in 1971 so associates owned part of the results, which fits Goleman's idea of empathy.",
      "Servant leadership means putting the needs of followers first, and Northouse lists it as one approach in his book.",
    ],
    question: "Which of those do you want to build on in your paper?",
  };
  const out = shapeStructuredAnswer({ raw, readings, leader: "Sam Walton", message: WALTON_Q });
  const bg = out.paras.find((p) => p.startsWith(BACKGROUND_LABEL))!;
  it("keeps the Walton facts under the label", () => {
    expect(out.leaderFacts).toBeGreaterThanOrEqual(2);
    expect(bg).toContain("visited hundreds of stores");
    expect(bg).toContain("profit sharing in 1971");
  });
  it("strips the author clause per item, never the whole Walton sentence", () => {
    expect(bg).not.toMatch(/Goleman|Northouse/);
    expect(bg).toContain("Servant leadership means putting the needs of followers first.");
  });
  it("ends with exactly one question that fits the list", () => {
    expect(out.paras.at(-1)).toBe("Which of those do you want to build on in your paper?");
    expect(out.paras.join(" ").match(/\?/g)).toHaveLength(1);
  });
  it("the QA 6:15 reply (definition + Northouse claim, no Walton facts) counts as NO leader facts (retry)", () => {
    const bad = shapeStructuredAnswer({
      raw: { explain: "", readingPoints: [], leaderFacts: ["Servant leadership means putting the needs of followers first, and Northouse lists it as one approach in his book."], question: "Which of those do you want to build on in your paper?" },
      readings,
      leader: "Sam Walton",
      message: WALTON_Q,
    });
    expect(bad.aboutLeader).toBe(true);
    expect(bad.leaderFacts).toBe(0);
    expect(bad.paras.join(" ")).not.toMatch(/Northouse/);
    expect(bad.paras.at(-1)).not.toMatch(/^Which of those/);
  });
  it("cleanLeaderFact drops a fact only when nothing concrete is left", () => {
    expect(cleanLeaderFact("This matches what Northouse describes in Chapter 4.", ["Northouse", "Goleman"])).toBeNull();
    expect(cleanLeaderFact("Walton drove an old pickup truck, just as Goleman says good leaders stay humble.", ["Northouse", "Goleman"])).toBe("Walton drove an old pickup truck.");
  });
  it("a reading point that ties Walton to a reading which never names him is dropped", () => {
    const o = shapeStructuredAnswer({
      raw: { explain: "", readingPoints: [{ text: "Goleman would say Walton showed empathy.", readingId: goleman.id }], leaderFacts: ["Walton greeted associates by name on store visits and asked for their ideas."], question: "" },
      readings,
      leader: "Sam Walton",
      message: WALTON_Q,
    });
    expect(o.paras.join(" ")).not.toMatch(/Goleman/);
  });
  it("no facts after the retry: says so plainly, suggests where to look, one question", () => {
    const r = noFactsReply("Sam Walton");
    expect(r[0]).toMatch(/don't have solid facts/);
    expect(r.join(" ").match(/\?/g)).toHaveLength(1);
  });
});

describe("QA 6:15 PM: 'main leadership styles' puts Goleman under readings, not background", () => {
  it("a reading point renders unlabelled with its reading's name", () => {
    const o = shapeStructuredAnswer({
      raw: {
        explain: "",
        readingPoints: [{ text: "The book surveys the major approaches, including situational, transformational and servant leadership.", readingId: northouse.id }],
        leaderFacts: ["Goleman argues that emotional intelligence, like empathy and self-awareness, is what sets the best leaders apart."],
        question: "Which of those styles fits the leader you have in mind?",
      },
      readings,
      leader: "Sam Walton",
      message: "What are the main leadership styles?",
    });
    const text = o.paras.join("\n");
    expect(text).toContain("From your Northouse chapter: The book surveys");
    expect(text).toContain("From your Goleman article: Goleman argues that emotional intelligence");
    expect(text).not.toContain(BACKGROUND_LABEL);
    expect(o.paras.at(-1)).toBe("Which of those styles fits the leader you have in mind?");
  });
  it("an unknown reading id is dropped", () => {
    const o = shapeStructuredAnswer({
      raw: { explain: "", readingPoints: [{ text: "Kotter lists eight steps for leading change.", readingId: "r9" }], leaderFacts: [], question: "" },
      readings,
      leader: null,
      message: "What are the main leadership styles?",
    });
    expect(o.paras.join(" ")).not.toMatch(/Kotter/);
  });
});

describe("QA 6:15 PM: one fitting question", () => {
  it("'Which of those' only after a list", () => {
    expect(fittingQuestion("Which of those do you want to use?", { items: 1, facts: 1, readings: 0 })).not.toMatch(/^Which of those/);
    expect(fittingQuestion("Which of those do you want to use?", { items: 3, facts: 3, readings: 0 })).toBe("Which of those do you want to use?");
    expect(fittingQuestion("", { items: 0, facts: 0, readings: 0 })).toMatch(/\?$/);
  });
  it("a stacked ask keeps one", () => {
    expect(fittingQuestion("Which habit stands out, and which would you lead with?", { items: 2, facts: 2, readings: 0 })).toBe("Which habit stands out?");
  });
});

describe("QA 6:15 PM: never 'Your paper will argue'", () => {
  it("the thesis-for-them pattern is caught and dropped from every part", () => {
    expect(THESIS_FOR_THEM.test("Your paper will argue that servant leadership works best.")).toBe(true);
    expect(THESIS_FOR_THEM.test("You picked servant leadership with Sam Walton.")).toBe(false);
    const o = shapeStructuredAnswer({
      raw: {
        explain: "Your paper will argue that servant leadership works best. A good intro starts with a hook.",
        readingPoints: [],
        leaderFacts: ["Walton shared profits with associates starting in 1971. You'll argue that this proves servant leadership works."],
        question: "Your thesis is that Walton served his people?",
      },
      readings,
      leader: "Sam Walton",
      message: WALTON_Q,
    });
    const text = o.paras.join(" ");
    expect(text).not.toMatch(/will argue|You'll argue|Your thesis is/);
    expect(text).toContain("A good intro starts with a hook.");
    expect(text).toContain("Walton shared profits");
  });
});

describe("QA 6:15 PM should-fix (c): every write-it-for-me request gets the warm template", () => {
  const cases: [string, RegExp][] = [
    ["Write my body paragraph about Walton", /What's the one thing you want that body paragraph to show about Walton\?$/],
    ["Just give me the intro paragraph", /your introduction says.*\?$/],
    ["Can you write my thesis statement?", /your thesis says, though\. What's your answer to the prompt/],
    ["draft my conclusion", /your conclusion says/],
    ["write a paragraph about Sam Walton for me", /show about Sam Walton\?$/],
    ["please write this sentence for me", /your sentence says/],
  ];
  for (const [m, re] of cases) {
    it(m, () => {
      expect(isWriteRequest(m)).toBe(true);
      const r = writeRequestReply("Body: Make your case", m);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatch(/^That part's yours to write, and it'll sound like you because of it\./);
      expect(r[0]).toMatch(re);
      expect(r[0]!.match(/\?/g)).toHaveLength(1);
    });
  }
  it("their own notes and teaching asks are not write requests", () => {
    for (const m of ["Write about how he listened to workers", "Show me an example outline line", "I want to write my intro about Walton myself", "Walton wrote a book about retail"]) expect(isWriteRequest(m)).toBe(false);
  });
});
