import { describe, expect, it } from "vitest";
import { readyVoiceLine, tallyVoiceWords } from "@/lib/stage1/voice";
import { answersAfterSkippingInterest } from "@/lib/stage1/intake-resume";

const words = (count: number) => "word ".repeat(count).trim();

describe("stage 1 voice tally", () => {
  it("counts each saved answer once, so a reload cannot swing 146 to 305", () => {
    const row = { questionId: "personal_1", text: words(146), isVoiceSample: true };
    expect(tallyVoiceWords([row])).toBe(146);
    expect(tallyVoiceWords([row, { ...row }, { ...row, text: words(146) }])).toBe(146);
  });

  it("does not drop counted answers when get-to-know-you is skipped", () => {
    const answers = [
      { questionId: "interest_1", kind: "interest", text: words(80), isVoiceSample: true },
      { questionId: "coaching_take", kind: "coaching", text: words(66), isVoiceSample: true },
    ];
    const kept = answersAfterSkippingInterest(answers);
    expect(tallyVoiceWords(kept.map((answer) => ({ ...answer })))).toBe(146);
  });

  it("shows the ready line only at the 200 word minimum", () => {
    expect(readyVoiceLine(194)).toBeNull();
    expect(readyVoiceLine(199)).toBeNull();
    expect(readyVoiceLine(200)).toMatch(/enough of your voice/);
  });
});
