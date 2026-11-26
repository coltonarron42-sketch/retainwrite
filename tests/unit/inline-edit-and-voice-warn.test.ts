import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as resumeLib from "@/lib/stage1/intake-resume";
import { stanceStartBlockers } from "@/lib/stage1/intake-resume";

describe("inline edit fields keep typed spaces", () => {
  it("does not trim or split list fields on every keystroke", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).not.toMatch(/e\.target\.value\s*\.split\("\\n"\)/);
    expect(intake).toContain("function ListTextarea");
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(loop).toContain("const [text, setText] = useState(value);");
  });
});

describe("voice is background only (PC-32, Colton t219u)", () => {
  it("never a Stage 1 condition or note", () => {
    expect(
      stanceStartBlockers({ checklistConfirmed: true, hasStory: true, stanceOk: true }),
    ).toEqual([]);
    expect("voiceShortNote" in resumeLib).toBe(false);
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
    expect(intake).not.toContain("readyVoiceLine");
    expect(intake).toContain("earlyStanceQuestion(");
  });
});

describe("stage 1 follow-ups", () => {
  it("keeps line breaks in Other instructions, has no voice short note, and saves drafts only on real edits", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain('key === "otherInstructions" ? (');
    expect(intake).not.toContain("voiceShortNote");
    const save = readFileSync("lib/papers/use-draft-save.ts", "utf8");
    expect(save).toContain("if (baseline.current.text === input.text) return;");
  });
});

describe("intake Continue feedback", () => {
  it("disables Continue and shows Saving… while the answer save is in flight", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain("sending={screen === \"story\" ? pickingStory === \"own\" : submitting}");
    expect(intake).toContain('{submitting ? <span role="status">Saving… </span> : null}');
    expect(intake).toContain("if (submitting || sendLock.current) return false;");
  });
});
