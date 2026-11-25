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
  it("says 'Pow', and drops quoted assignment text", () => {
    expect(speakableSentences("Hi, I'm Pau. Let's go.")).toEqual(["Hi, I'm Pow.", "Let's go."]);
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
  it("skips UI instructions", () => {
    expect(speakableSentences("Tell me a little more: what's the topic? Or tap + to add the assignment sheet.")).toEqual(["Tell me a little more: what's the topic?"]);
    expect(speakableSentences("When has this come up for you? Write at least a few sentences.")).toEqual(["When has this come up for you?"]);
    expect(speakableSentences("Give me a little more — a couple more sentences? Your early take is almost there. Add to it below.")).toEqual(["Give me a little more, a couple more sentences?", "Your early take is almost there."]);
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
    expect(s).toContain("if (sparksRef.current[key] || chatPrefs.sparkOff) return;");
    expect(s).toContain('coachingPlan[qIndex].kind !== "background"');
    const h = readFileSync("components/stages/stage1/hesitation.tsx", "utf8");
    expect(h).toContain("No thanks");
    expect(h).toContain("Don&apos;t offer again");
    expect(s).toContain('setChatPref("sparkOff", true)');
  });
  it("mic stops speech", () => {
    expect(readFileSync("components/stages/stage1/chat-composer.tsx", "utf8")).toContain("stopSpeech();");
  });
});

describe("sentence splitting keeps abbreviations together", () => {
  it("does not break at Prof., Dr., U.S., e.g., etc.", async () => {
    const { splitSentences } = await import("@/lib/text/sentences");
    expect(splitSentences("Sounds like ENG 101 and Prof. Dana Ruiz: a 5 page essay. It's due Friday.")).toEqual([
      "Sounds like ENG 101 and Prof. Dana Ruiz: a 5 page essay.",
      "It's due Friday.",
    ]);
    expect(splitSentences("Ask Dr. Kim or Mr. Lee. Mrs. Ortiz and Ms. Park too.")).toEqual([
      "Ask Dr. Kim or Mr. Lee.",
      "Mrs. Ortiz and Ms. Park too.",
    ]);
    expect(splitSentences("It covers the U.S. Senate, e.g. filibusters, i.e. delays, etc. and more. Then St. Louis vs. Chicago.")).toEqual([
      "It covers the U.S. Senate, e.g. filibusters, i.e. delays, etc. and more.",
      "Then St. Louis vs. Chicago.",
    ]);
    expect(speakableSentences("Looks like a paper for Prof. Dana Ruiz. It's due Friday.")).toEqual([
      "Looks like a paper for Prof. Dana Ruiz.",
      "It's due Friday.",
    ]);
  });
});

describe("what actually reaches speechSynthesis", () => {
  it("'Pau' is handed to the speech engine as 'Pow', one sentence per utterance, in order", async () => {
    const spoken: string[] = [];
    class FakeUtterance {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    const synth = {
      speak(u: FakeUtterance) {
        spoken.push(u.text);
        setTimeout(() => u.onend?.(), 0);
      },
      cancel() {},
      getVoices: () => [],
    };
    const g = globalThis as Record<string, unknown>;
    g.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    g.SpeechSynthesisUtterance = FakeUtterance;
    const { speak, stopSpeech } = await import("@/lib/voice/speech");
    speak(["Hi, I'm Pau. Pau will ask a few questions."]);
    await new Promise((r) => setTimeout(r, 20));
    expect(spoken).toEqual(["Hi, I'm Pow.", "Pow will ask a few questions."]);
    expect(spoken.join(" ")).not.toContain("Pau");
    stopSpeech();
    delete g.window;
    delete g.SpeechSynthesisUtterance;
  });
});

describe("QA retest fixes", () => {
  const intake = () => readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
  it("no visible word-count numbers for the early take", async () => {
    const { EARLY_STANCE_MIN_NOTE } = await import("@/lib/stage1/early-stance");
    expect(EARLY_STANCE_MIN_NOTE).not.toMatch(/\d/);
    expect(intake()).not.toContain("≥ 25 words");
    expect(intake()).not.toContain("at least 25 words");
  });
  it("spark exchange never invents student bubbles", () => {
    const s = intake();
    expect(s).not.toMatch(/EchoBubble[\s\S]{0,200}"No thanks"/);
    expect(readFileSync("components/stages/stage1/hesitation.tsx", "utf8")).not.toContain("EchoBubble");
  });
  it("edit mode re-asks aloud (fresh read-aloud key per edit)", () => {
    expect(intake()).toContain("edit:${editSeq}:${q.id}");
  });
});
