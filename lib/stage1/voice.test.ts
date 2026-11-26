import { describe, expect, it } from "vitest";
import { collectVoiceSampleText, tallyVoiceWords } from "@/lib/stage1/voice";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

// PC-32 (Colton t219u, Nov 25, 2026): the Stage 1 voice minimum is retired. These helpers
// only describe what was said; nothing here can hold a student back.
describe("stage1 voice helpers (no minimum)", () => {
  it("joins every flagged answer and tallies once per question", () => {
    const answers = [
      { text: words(10), isVoiceSample: true, kind: "coaching" },
      { text: words(5), isVoiceSample: true, kind: "background" },
    ];
    expect(collectVoiceSampleText(answers).split(/\s+/)).toHaveLength(15);
    expect(tallyVoiceWords([{ questionId: "a", text: words(3), isVoiceSample: true }, { questionId: "a", text: words(4), isVoiceSample: true }])).toBe(4);
  });
});
