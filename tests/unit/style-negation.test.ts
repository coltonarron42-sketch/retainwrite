import { describe, expect, it } from "vitest";
import { affirmsStyle, rejectsStyle } from "@/lib/stage1/style-negation";
import { chosenStyles, informedAffirm, informedNext, lockedPicks, stylesIn } from "@/lib/stage1/north-turns";
import { answerNamesOption, pickFrom, pickedStyles, vaguePickProbe, midSentenceLabel, confirmPickNudge, pickFromWhyProbe } from "@/lib/stage1/paper-context";
import { northstarChecklist } from "@/lib/stage1/intake-resume";
import { askKind, moreWordsNote } from "@/lib/stage1/chat-copy";
import { isReadingComment, readingCommentAck } from "@/lib/stage1/paper-context";
import { readFileSync } from "node:fs";

const heads = (xs: string[]) => xs.map((x) => x.toLowerCase().split(" ")[0]).sort();
const QA = "Servant, not transformational, because Walton put associates first and didn't really sell a big vision.";
const OPTIONS = [
  { label: "Transformational leadership", why: "a big vision" },
  { label: "Servant leadership", why: "people first" },
  { label: "Situational leadership", why: "fit the moment" },
];

describe("QA prod smoke 64a5b2bd: a style set aside is never chosen", () => {
  it("the exact QA sentence is servant only, everywhere", () => {
    expect(stylesIn(QA)).toEqual(["servant"]);
    expect(chosenStyles([QA])).toEqual(["servant"]);
    expect(pickedStyles({ pick: "Servant leadership", answer: QA }, OPTIONS)).toEqual(["Servant"]);
    expect(pickFrom(QA, OPTIONS)).toBe("Servant leadership");
    expect(answerNamesOption(QA, "Transformational leadership")).toBe(false);
    const turn = informedAffirm(QA, { leader: "Sam Walton", mustInclude: [] }).join("\n");
    expect(turn).toContain("Sam Walton, showing servant leadership");
    expect(turn).not.toMatch(/transformational/i);
    expect(lockedPicks(QA, "Sam Walton", stylesIn(QA))).toBe("Sam Walton, servant leadership");
    const gate = northstarChecklist({ confirmed: true, catchUpDone: true, decided: true, stanceOk: true, styles: chosenStyles([QA]), leader: "Walton" });
    expect(gate[2]!.label).toBe("Decision made, with your reason: your style: servant, your leader: Walton");
    expect(informedNext(QA, "Sam Walton")).not.toMatch(/transformational/i);
  });

  const servantOnly = [
    "Servant, not transformational.",
    "servant not transformational",
    "Servant leadership, not really transformational.",
    "I'd go servant rather than transformational.",
    "Servant instead of transformational, because he listened.",
    "I think it's less transformational and more servant.",
    "More servant than transformational.",
    "Servant over transformational, honestly.",
    "Transformational isn't it. Servant is.",
    "Transformational leadership doesn't fit; servant does.",
    "Not transformational. Servant, because associates came first.",
    "It was never transformational, it was servant.",
    "Servant. He wasn't really that transformational.",
    "Servant without the transformational stuff.",
    "Servant leadership rather than the transformational kind.",
    "Not so much transformational, more servant.",
  ];
  for (const s of servantOnly) {
    it(`servant only: ${s}`, () => {
      expect(stylesIn(s)).toEqual(["servant"]);
      expect(chosenStyles([s])).toEqual(["servant"]);
      expect(heads(pickedStyles({ answer: s }, OPTIONS))).toEqual(["servant"]);
      expect(answerNamesOption(s, "Transformational leadership")).toBe(false);
      expect(pickFrom(s, OPTIONS)).toBe("Servant leadership");
    });
  }

  const both = [
    "Servant and transformational.",
    "Servant and transformational leadership, because Walton put associates first and sold a vision.",
    "Not just servant but transformational too.",
    "Not only servant, also transformational.",
    "Both: servant leadership and transformational leadership.",
  ];
  for (const s of both) {
    it(`both kept: ${s}`, () => {
      expect(stylesIn(s).sort()).toEqual(["servant", "transformational"]);
      expect(chosenStyles([s]).sort()).toEqual(["servant", "transformational"]);
      expect(heads(pickedStyles({ answer: s }, OPTIONS))).toEqual(["servant", "transformational"]);
    });
  }

  it("a later real mention brings a style back", () => {
    expect(affirmsStyle("Not transformational at first, but later he was transformational.", "transformational")).toBe(true);
    expect(rejectsStyle("Servant, not transformational.", "transformational")).toBe(true);
    expect(rejectsStyle("Servant, not transformational.", "servant")).toBe(false);
    expect(rejectsStyle("Servant.", "transformational")).toBe(false);
  });

  it("the transformational-only mirror works too", () => {
    const s = "Transformational, not servant, because Walton sold a big vision.";
    expect(stylesIn(s)).toEqual(["transformational"]);
    expect(pickFrom(s, OPTIONS)).toBe("Transformational leadership");
  });
});

describe("QA prod smoke 51dddefe: nudges match the question on screen", () => {
  const exampleQ = "Next up is your example. When did Sam Walton have to lead people through a big change, and what did they do? Two or three sentences, rough is fine.";
  it("knows the question type", () => {
    expect(askKind(exampleQ)).toBe("example");
    expect(askKind("Next up is the change part. When did Sam Walton have to lead people through a big change, and how did servant leadership show up in it?")).toBe("example");
    expect(askKind("Now your case: how did servant leadership show up in that moment, and why does it work best for this assignment?")).toBe("case");
    expect(askKind("Which leadership style do you think works best, and why?")).toBe("claim");
  });
  it("an example question never gets claim or why nudges", () => {
    const tries = ["Walmart", "In 1962 Walton", "He visited stores", "In 1962 Walton opened stores and visited every one of them", ""];
    tries.forEach((t, i) => {
      const n = moreWordsNote(1, 15, "Your own angle", t, i, "example");
      expect(n).not.toMatch(/Start with what you think|Now the why|which approach works best|what makes it the right call/i);
      expect(n).toMatch(/moment|did|happened|changed/i);
    });
  });
  it("the claim path is unchanged", () => {
    expect(moreWordsNote(1, 25, "Your early take", "hmm ok", 0)).toContain("Start with what you think");
  });
  it("a case question with no pick asks to tie it to the pick", () => {
    expect(moreWordsNote(1, 25, "Your early take", "he went to stores", 0, "case")).toContain("Tie it to your pick");
  });
});


describe("QA #76 re-verify: a known leader is never a style", () => {
  it("Sam Walton, servant leadership lists servant only, never walton as a style", () => {
    const t = "Sam Walton, servant leadership";
    expect(stylesIn(t)).toEqual(["servant"]);
    expect(stylesIn(t, "Sam Walton")).toEqual(["servant"]);
    expect(chosenStyles([t, "yes"])).toEqual(["servant"]);
    const turn = informedAffirm(t, { leader: "Sam Walton", mustInclude: [], needsPerson: true }).join("\n");
    expect(turn).toMatch(/✓ Your style: servant/);
    expect(turn).not.toMatch(/Your styles: walton and servant/i);
    expect(turn).not.toMatch(/walton and servant/i);
    expect(turn).toMatch(/✓ A real leader as your example: Sam Walton/);
    expect(informedNext(t, "Sam Walton")).toMatch(/servant leadership/);
    expect(informedNext(t, "Sam Walton")).not.toMatch(/walton and servant/i);
  });
});

describe("QA #76: a comment about a reading is light engagement, never an example-moment probe (t222u)", () => {
  const QA = "Northouse ch 4 covers the behavioral approach, which I found interesting.";
  it("detects the QA reading comment and does not treat it as a leader moment", () => {
    expect(isReadingComment(QA)).toBe(true);
    const ack = readingCommentAck(QA);
    expect(ack).toMatch(/Got it/i);
    expect(ack).toMatch(/noted/i);
    expect(ack).toMatch(/Northouse ch 4/i);
    expect(ack).toMatch(/behavioral approach/i);
    expect(ack).not.toMatch(/When was it\?/i);
    expect(ack).not.toMatch(/Name the moment/i);
    expect(ack).not.toMatch(/what they did/i);
    // The old example-step nudge is exactly what QA heard, and must not be used for this comment.
    const probe = moreWordsNote(1, 15, "Your own angle", QA, 0, "example");
    expect(probe).toMatch(/When was it\? Name the moment, then what they did/);
    expect(ack).not.toBe(probe);
    expect(isReadingComment("he went to stores")).toBe(false);
    expect(isReadingComment("Sam Walton, servant leadership")).toBe(false);
    expect(isReadingComment("When Walton visited stores he listened, which I found interesting.")).toBe(false);
    expect(
      isReadingComment(
        "I think servant leadership works best because Northouse ch 4 covers the behavioral approach, which I found interesting, and I'd use Walton as my example.",
      ),
    ).toBe(false);
  });
  it("Stage 1 notes a reading comment as an aside before the example-moment moreWordsNote", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toMatch(/isReadingComment\(text\)/);
    expect(intake).toMatch(/readingCommentAck/);
    const own = intake.indexOf("async function submitOwnStory");
    const comment = intake.indexOf("isReadingComment(text)", own);
    const nudge = intake.indexOf('exampleStep ? "example" : "claim"', own);
    const visible = intake.indexOf("setError(ack)", own);
    const echo = intake.indexOf("setShortEcho(text)", own);
    expect(own).toBeGreaterThan(0);
    expect(comment).toBeGreaterThan(own);
    expect(visible).toBeGreaterThan(comment);
    expect(echo).toBeGreaterThan(comment);
    expect(nudge).toBeGreaterThan(visible);
    expect(intake.slice(own, nudge)).toMatch(/The story screen has no `q`/);
  });
});

describe("QA #76: a bare yes after why confirms the pick, never a reteach", () => {
  const opts = [
    { label: "Transformational", why: "a shared vision" },
    { label: "Situational", why: "fit how ready the team is" },
    { label: "Servant", why: "puts the team first" },
  ];
  it("lowercases servant mid-sentence in the why probe", () => {
    expect(midSentenceLabel("Servant")).toBe("servant");
    expect(midSentenceLabel("Servant leadership")).toBe("servant leadership");
    expect(midSentenceLabel("Sam Walton")).toBe("Sam Walton");
    const probe = vaguePickProbe("Sam Walton, servant leadership", opts);
    expect(probe).toBe(
      "Sounds like you're leaning toward servant. Why that one? What about it fits this assignment for you? One sentence is plenty.",
    );
    expect(probe).not.toMatch(/leaning toward Servant\./);
  });
  it("a bare yes after that why-question confirms the pick with a light nudge, never a reteach", () => {
    const probe = vaguePickProbe("Sam Walton, servant leadership", opts);
    const picked = pickFromWhyProbe(probe, opts);
    expect(picked?.label).toBe("Servant");
    expect(confirmPickNudge(picked!.label)).toBe(
      "Got it — you're going with servant. In a sentence, what about it fits this assignment? Or we can move on and come back to the why.",
    );
    expect(confirmPickNudge(picked!.label)).not.toMatch(/short version of each/i);
    expect(confirmPickNudge("Servant leadership")).toMatch(/you're going with servant leadership\./);
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    const why = intake.indexOf("a bare yes after \"Why that one?\" confirms the guessed pick");
    const esc = intake.indexOf("pickEscalation({", why);
    expect(why).toBeGreaterThan(0);
    expect(esc).toBeGreaterThan(why);
    expect(intake.slice(why, esc)).toMatch(/confirmPickNudge/);
    expect(intake.slice(why, esc)).toMatch(/isYesSaying\(text\)/);
  });
});
