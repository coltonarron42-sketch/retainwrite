import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { speakableSentences } from "@/lib/voice/speakable";
import { __resetSpeech, takeNew } from "@/lib/voice/speech";
import {
  SPARK_OFFER,
  fallbackSparkQuestions,
  isHeavyDelete,
  sparkKind,
  validateSparkQuestions,
} from "@/lib/stage1/spark";

describe("speakable text", () => {
  it("says 'Pow pow', and drops quoted assignment text", () => {
    expect(speakableSentences("Hi, I'm Pau Pau. Let's go.")).toEqual(["Hi, I'm Pow pow.", "Let's go."]);
    const s = speakableSentences(
      "It calls for at least three scholarly sources, including the American Academy of Pediatrics' “School Start Times for Adolescents” (2014). The big question: “Should schools start later?” You'll be writing about sleep.",
    );
    expect(s).toEqual(["It calls for at least three scholarly sources."]);
  });
  it("rewrites 'the question “…”' to 'this question'", () => {
    expect(
      speakableSentences("When has the question “Should schools start later?” come up in real life — school, work, family?"),
    ).toEqual(["When has this question come up in real life, school, work, family?"]);
  });
  it("reads number ranges naturally", () => {
    expect(speakableSentences("A 1,200–1,500 word paper.")).toEqual(["A 1,200 to 1,500 word paper."]);
  });
});

describe("only new bubbles are read", () => {
  it("first render marks existing bubbles as seen; later ones are new; repeats are not re-read", () => {
    __resetSpeech();
    expect(takeNew("p1", [{ key: "a", text: "A." }])).toEqual([]);
    expect(takeNew("p1", [{ key: "a", text: "A." }, { key: "b", text: "B." }]).map((i) => i.key)).toEqual(["b"]);
    expect(takeNew("p1", [{ key: "a", text: "A." }, { key: "b", text: "B." }])).toEqual([]);
  });
});

describe("hesitation spark", () => {
  it("heavy delete means most of a real attempt was removed", () => {
    expect(isHeavyDelete(60, 10)).toBe(true);
    expect(isHeavyDelete(60, 40)).toBe(false);
    expect(isHeavyDelete(10, 0)).toBe(false);
  });
  it("keeps only short open questions, never suggested wording", () => {
    expect(
      validateSparkQuestions([
        "When did you last feel too tired to focus in class?",
        "You could write about your morning routine?",
        "Here's a thesis: sleep matters?",
        "Who in your life has a strong opinion about school start times?",
        "Try starting with a story.",
      ]),
    ).toEqual([
      "When did you last feel too tired to focus in class?",
      "Who in your life has a strong opinion about school start times?",
    ]);
    expect(validateSparkQuestions(["Only one question?"])).toBeNull();
  });
  it("fallback questions are open questions and pass the same check", () => {
    for (const id of ["interest_1", "coaching_take", "personal_1", "stance_early", "x"]) {
      const kind = sparkKind(id, id.split("_")[0]);
      expect(validateSparkQuestions(fallbackSparkQuestions(kind))).toEqual(fallbackSparkQuestions(kind));
    }
    expect(SPARK_OFFER).toBe("Want me to ask a couple questions that might spark something?");
  });
  it("intake offers once per question, with Yes / No thanks / Don't offer again, and never for background", () => {
    const s = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(s).toContain("wasOffered(paperId, key)");
    expect(s).toContain('coachingPlan[qIndex].kind !== "background"');
    expect(s).toContain("No thanks");
    expect(s).toContain("Don&apos;t offer again");
    expect(s).toContain('setChatPref("sparkOff", true)');
  });
  it("mic stops speech", () => {
    expect(readFileSync("components/stages/stage1/chat-composer.tsx", "utf8")).toContain("stopSpeech();");
  });
});
