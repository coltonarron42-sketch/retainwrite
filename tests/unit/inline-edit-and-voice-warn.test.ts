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
    expect(intake).toContain("Previous question");
    expect(intake).toContain("voiceEval.ok && readyVoiceLine");
    expect(intake).toContain("earlyTakeSubject(");
  });
});
