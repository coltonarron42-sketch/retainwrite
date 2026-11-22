import { describe, expect, it } from "vitest";
import { PAU_PERSONALITY, SAMPLE_QUIPS } from "@/lib/coach/personality";
import { STAGE2_QUIPS } from "@/lib/coach/quips";
import { toneIssues } from "@/lib/coach/tone";
import { WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";
import { LESSON_PROBE_OPENER, MEMORY_CONFIRM, MEMORY_PROBE_OPENER } from "@/lib/coaching/memoryPath";
import { LOGIC_OPENER, LOGIC_STRONG_HEADLINE } from "@/lib/coaching/logicCheck";
import { THIN_NOTE } from "@/lib/coaching/thin";
import { ASSIGNMENT_ASK, ASSIGNMENT_GREETING, INTRO_BUBBLES, PLACEHOLDERS } from "@/lib/stage1/chat-copy";
import { CONFIRM_INVITE, RECONFIRM_ASK, SUMMARY_OPENERS } from "@/lib/stage1/pau-pau";
import { SPARK_OFFER } from "@/lib/stage1/spark";
import { logicOpenerText, stanceTurnParas } from "@/components/stages/loop/stance-chat";
import { isTtsCandidate, TTS_CANDIDATES, ttsFallbackVoice, ttsVoiceId, TTS_SPEED } from "@/lib/voice/tts-config";

const sec = (title: string) => ({ key: title.toLowerCase(), title, mode: "lesson", ideas: [], concept: null }) as never;
const ctx = (t: string, i: number) => ({ section: sec(t), card: null, mirrorAsk: "", activeTrigger: null, seed: "tone", index: i });

const TEMPLATE_LINES: string[] = [
  ASSIGNMENT_GREETING, ASSIGNMENT_ASK, ...INTRO_BUBBLES, ...Object.values(PLACEHOLDERS),
  CONFIRM_INVITE, RECONFIRM_ASK, ...SUMMARY_OPENERS, SPARK_OFFER,
  LESSON_PROBE_OPENER, MEMORY_PROBE_OPENER, MEMORY_CONFIRM, LOGIC_OPENER, LOGIC_STRONG_HEADLINE, THIN_NOTE,
  ...WELCOME_BACK_LINES, ...STAGE2_QUIPS, ...SAMPLE_QUIPS,
  ...["Introduction", "Body", "Conclusion"].flatMap((t, i) => [...stanceTurnParas("probe", ctx(t, i)), ...stanceTurnParas("pick_lead", ctx(t, i)), ...stanceTurnParas("confirm", ctx(t, i)), logicOpenerText("tone", i)]),
];

describe("4:00 PM: a younger, relaxed, conversational voice in writing", () => {
  it("the shared personality describes the down-to-earth comic voice and keeps the guardrails", () => {
    expect(PAU_PERSONALITY).toMatch(/down-to-earth stand-up comic/);
    expect(PAU_PERSONALITY).toMatch(/contractions/);
    expect(PAU_PERSONALITY).toMatch(/short sentences/);
    expect(PAU_PERSONALITY).toMatch(/Never stiff, polished or corporate/);
    expect(PAU_PERSONALITY).toMatch(/At most ONE small quip/);
    expect(PAU_PERSONALITY).toMatch(/never at the student's expense/);
    expect(PAU_PERSONALITY).toMatch(/never write any part of their paper/);
  });
  it.each(TEMPLATE_LINES.map((t) => [t]))("template line reads casual: %s", (line) => {
    expect(toneIssues(line)).toEqual([]);
  });
  it("her template copy actually uses contractions", () => {
    const all = TEMPLATE_LINES.join(" ");
    expect((all.match(/\b\w+'(s|re|ll|ve|d|t|m)\b/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
  it("the checker catches stiff copy", () => {
    expect(toneIssues("Certainly! I would be happy to help. You are doing great.")).not.toEqual([]);
    expect(toneIssues("In order to proceed, please note the rubric.")).not.toEqual([]);
    expect(toneIssues("You're close. Let's look at the rubric.")).toEqual([]);
  });
});

describe("4:00 PM: her spoken voice", () => {
  it("candidates are xAI voices described as casual and natural; speed stays in xAI's range", () => {
    expect(TTS_CANDIDATES.castor).toMatch(/down-to-earth/);
    expect(isTtsCandidate("castor")).toBe(true);
    expect(isTtsCandidate("zagan")).toBe(false);
    expect(TTS_SPEED).toBeGreaterThanOrEqual(0.7);
    expect(TTS_SPEED).toBeLessThanOrEqual(1.5);
    expect(isTtsCandidate(ttsVoiceId())).toBe(true);
    expect(ttsFallbackVoice(ttsVoiceId())).not.toBe(ttsVoiceId());
  });
});
