/** PC-32 (Colton t219u, Nov 25, 2026): voice capture runs in the background; Stage 1 never asks for it. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildVoiceCorpus, collectVoicePieces, voiceLineFrom } from "@/lib/style/voice-capture";
import { STAGE1_RULES } from "@/lib/voice/realtime/persona";
import { INTRO_BUBBLES } from "@/lib/stage1/chat-copy";
import { stanceStartBlockers } from "@/lib/stage1/intake-resume";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const complete = readFileSync("app/api/papers/[paperId]/intake/complete/route.ts", "utf8");
const nextQ = readFileSync("app/api/papers/[paperId]/intake/next-question/route.ts", "utf8");
const autosave = readFileSync("app/api/papers/[paperId]/autosave/route.ts", "utf8");
const progress = readFileSync("app/api/papers/[paperId]/progress/route.ts", "utf8");
const store = readFileSync("lib/server/paper-context/store.ts", "utf8");
const plan = readFileSync("PLAN.md", "utf8");

describe("collectVoicePieces: every student-authored answer, every stage", () => {
  const pieces = collectVoicePieces({
    intake: [
      { questionId: "material_check", kind: "background", text: "I haven't read it yet, honestly no idea what it says." },
      { questionId: "decision_pick", kind: "coaching", text: "Servant, because the coach I had listened first." },
      { questionId: "decision_pick", kind: "coaching", text: "Servant, because my old coach listened before he talked." },
      { questionId: "bg_comfort", kind: "background", text: "skip", skipped: true },
      { questionId: "story", kind: "story_angle", text: "An angle the app wrote for them." },
    ],
    session: {
      answers: [
        { kind: "probe", text: "He'd ask everyone on the team what they saw before deciding anything big." },
        { kind: "assignment_paste", text: "Write a 1500 word paper on leadership styles." },
        { kind: "stage3_note", text: "Intro starts with the bus ride after we lost." },
      ],
      transcript: [
        { who: "pau", text: "What did that look like?" },
        { who: "you", text: "Like he never yelled, he just asked questions." },
        { who: "pick", text: "Picked: servant" },
      ],
      outlineTranscript: [{ who: "you", text: "ok" }, { who: "you", text: "Body two is about the playoff game." }],
    },
  });
  const texts = pieces.map((p) => p.text);
  it("keeps the student's own words from Stages 1, 2 and 3", () => {
    expect(pieces.map((p) => p.stage)).toEqual([1, 1, 2, 3, 2, 3]);
    expect(texts).toContain("Like he never yelled, he just asked questions.");
    expect(texts).toContain("Body two is about the playoff game.");
  });
  it("latest Stage 1 save wins; skips, story angles, pastes, Pau and taps never count", () => {
    expect(texts.filter((t) => t.startsWith("Servant"))).toEqual(["Servant, because my old coach listened before he talked."]);
    expect(texts.join(" ")).not.toMatch(/skip|An angle the app wrote|1500 word|What did that look like|Picked:/);
    expect(texts).not.toContain("ok");
  });
  it("buildVoiceCorpus caps to the most recent words and reports stages", () => {
    const c = buildVoiceCorpus(pieces, 30);
    expect(c.words).toBeLessThanOrEqual(30);
    expect(c.text).toContain("Body two is about the playoff game.");
    expect(c.typedWordShare).toBe(1);
    expect(buildVoiceCorpus([]).words).toBe(0);
  });
  it("voiceLineFrom falls back to a real recent answer", () => {
    expect(voiceLineFrom(pieces)).toBe("He'd ask everyone on the team what they saw before deciding anything big.");
    expect(voiceLineFrom([])).toBeNull();
  });
});

describe("Stage 1 has no voice step, gate, progress item or copy", () => {
  it("no new personal_1 / fallback_voice questions (only kept when already answered)", () => {
    expect(intake).toContain('if (!northstar && has("personal_1")) plan.push({');
    expect(intake).toContain('if (!northstar && has("fallback_voice")) {');
    expect(intake).not.toMatch(/needFallback|fallbackOff|evaluateStage1VoiceMinimum|voiceEval|voiceWordsMet/);
  });
  it("the gate and composer never mention voice amount", () => {
    expect(intake).not.toMatch(/Voice sample|match your voice|enough of your voice|less of your voice|Voice ✓/);
    expect(stanceStartBlockers({ checklistConfirmed: true, hasStory: true, stanceOk: true })).toEqual([]);
  });
  it("Pau's intro and the Grok Voice Stage 1 role are assignment, summary and direction only", () => {
    expect(INTRO_BUBBLES.join(" ")).not.toMatch(/how you write|voice/i);
    expect(STAGE1_RULES).toMatch(/only job is three things: get the assignment in, make sure they understand it/);
    expect(STAGE1_RULES).not.toMatch(/voice sample|what they're into|their background/);
    expect(STAGE1_RULES).toMatch(/never ask for a writing sample/);
    // Coaching-only rules stay.
    expect(STAGE1_RULES).toMatch(/You never write any part of their paper/);
  });
});

describe("background capture is wired server-side (no migration)", () => {
  it("every Stage 1 answer is flagged and refreshes the profile after the response", () => {
    expect(nextQ).toContain("const isVoice = !body.skipThisQuestion;");
    expect(nextQ).toMatch(/after\(\(\) => refreshVoiceProfile\(supabase, paperId, uid, \{ throttleMs: 20_000/);
  });
  it("Stage 1 complete refreshes from everything saved; voice is never a condition", () => {
    expect(complete).toContain("refreshVoiceProfile(supabase, paperId, user.id");
    expect(complete).not.toMatch(/evaluateStage1VoiceMinimum|voiceShort|isVoiceSample\)/);
  });
  it("Stage 2/3 session saves and stage moves feed it too", () => {
    expect(autosave).toMatch(/body\.session !== undefined\) \{\n\s+after\(\(\) => refreshVoiceProfile/);
    expect(progress).toMatch(/if \(move\.advanced\) \{[\s\S]*refreshVoiceProfile/);
  });
  it("Pau's 'how they talk' line falls back to the accumulated answers", () => {
    expect(store).toContain("voiceLineFrom(await loadVoicePieces(supabase, paperId))");
  });
  it("PLAN.md records the decision", () => {
    expect(plan).toMatch(/Voice capture runs in the background \(Colton t219u, Nov 25, 2026; PC-32\)/);
  });
});
