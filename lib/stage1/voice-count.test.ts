import { describe, expect, it } from "vitest";
import { tallyVoiceWords } from "@/lib/stage1/voice";
import * as voiceLib from "@/lib/stage1/voice";
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

  it("PC-32: no ready line or voice minimum any more (voice is captured in the background)", () => {
    expect("readyVoiceLine" in voiceLib).toBe(false);
    expect("evaluateStage1VoiceMinimum" in voiceLib).toBe(false);
  });
});
