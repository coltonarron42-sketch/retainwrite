import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stanceStartBlockers, voiceShortNote } from "@/lib/stage1/intake-resume";

describe("inline edit fields keep typed spaces", () => {
  it("does not trim or split list fields on every keystroke", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).not.toMatch(/e\.target\.value\s*\.split\("\\n"\)/);
    expect(intake).toContain("function ListTextarea");
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(loop).toContain("const [text, setText] = useState(value);");
  });
});

describe("voice minimum is a warning", () => {
  it("never blocks Start stance interview on a short voice sample", () => {
    expect(
      stanceStartBlockers({ checklistConfirmed: true, hasStory: true, voiceOk: false, stanceOk: true }),
    ).toEqual([]);
    expect(voiceShortNote({ voiceOk: false })).toMatch(/keep going/);
    expect(voiceShortNote({ voiceOk: true })).toBeNull();
    const route = readFileSync("app/api/papers/[paperId]/intake/complete/route.ts", "utf8");
    expect(route).not.toContain("Voice minimum not met");
  });

  it("reopens earlier answers prefilled and fixes the copy", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain("function openQuestion");
    expect(intake).toContain("setDraftAnswer(savedAnswerText(target.id));");
    // Earlier answers are edited by tapping their bubble in the thread.
    expect(intake).toContain("function editAnswer");
    expect(intake).toContain("Edit your answer to: ${item.text}");
    expect(intake).toContain("voiceWordsMet && readyVoiceLine");
    expect(intake).toContain("earlyStanceQuestion(");
  });
});

describe("stage 1 follow-ups", () => {
  it("keeps line breaks in Other instructions, hides the short note at 200 words, and saves drafts only on real edits", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain('key === "otherInstructions" ? (');
    expect(intake).toContain("voiceShortNote({ voiceOk: voiceWordsMet })");
    const save = readFileSync("lib/papers/use-draft-save.ts", "utf8");
    expect(save).toContain("if (baseline.current.text === input.text) return;");
  });
});

describe("intake Continue feedback", () => {
  it("disables Continue and shows Saving… while the answer save is in flight", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain("sending={submitting}");
    expect(intake).toContain('{submitting ? <span role="status">Saving… </span> : null}');
    expect(intake).toContain("if (submitting || sendLock.current) return false;");
  });
});
