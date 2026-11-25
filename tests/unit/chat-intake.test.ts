import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESCRIBED_MIN_WORDS } from "@/lib/assignment/parse";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const composer = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
const route = readFileSync("app/api/papers/[paperId]/assignment/parse/route.ts", "utf8");

describe("Stage 1 chat-style assignment input", () => {
  it("asks the question as a Pau bubble with one field and the soft placeholder", () => {
    expect(intake).toContain("ASSIGNMENT_ASK,");
    expect(intake).toContain('placeholder="Upload a photo, PDF, or Word file, or just tell me about it…"');
    expect(intake).toContain('labelledBy="assignment-ask"');
  });

  it("keeps Send off while files are reading or failed", () => {
    expect(composer).toContain("const blocked = !hasContent || reading || failed || sendBlocked;");
    // While a reply loads, Send is off and the text stays in the box (QA 9:37 AM).
    expect(composer).toContain("disabled={blocked}");
  });

  it("the mic only types the student's words into the field, never sends", () => {
    const mic = composer.slice(composer.indexOf("function toggleMic"), composer.indexOf("function pick"));
    expect(mic).toContain("onChange(");
    expect(mic).not.toContain("onSend");
    expect(mic).not.toContain("send()");
  });

  it("+ opens the three-choice photo menu (camera roll, files, camera) for every accepted type", () => {
    expect(composer).toContain('"From camera roll"');
    expect(composer).toContain('"From files"');
    expect(composer).toContain('"Use camera"');
    expect(composer).toContain("accept={ASSIGNMENT_ACCEPT}");
  });

  it("a typed description with no file goes through the same parse, with a short-text allowance", () => {
    expect(intake).toContain("described: !hasFiles || undefined");
    expect(route).toContain("minWords: body.described ? DESCRIBED_MIN_WORDS : undefined");
    expect(DESCRIBED_MIN_WORDS).toBeLessThanOrEqual(6);
  });

  it("the later Stage 1 questions use the same bubble and input", () => {
    expect(intake).toContain('labelledBy={screen === "story" ? "story-ask" : "coach-question"}');
    expect(intake).toContain('sendLabel="Send"');
    expect(intake).not.toContain('sendLabel="Continue"');
  });
});
