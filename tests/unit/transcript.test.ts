import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinTranscript } from "@/lib/stage1/transcript";

describe("joinTranscript (voice typing)", () => {
  it("puts a space between typed text and speech", () => {
    expect(joinTranscript("I like soccer and", ["baking"])).toBe("I like soccer and baking");
  });
  it("puts a space between phrases that arrive without one (Android Chrome)", () => {
    expect(joinTranscript("", ["I like soccer", "and baking"], "with my")).toBe("I like soccer and baking with my");
  });
  it("does not double spaces when a phrase already has one", () => {
    expect(joinTranscript("I like  ", [" soccer", " and"], " baking ")).toBe("I like soccer and baking");
  });
  it("keeps the typed text first, never after the speech", () => {
    const out = joinTranscript("I like soccer and", [], "baking");
    expect(out.startsWith("I like soccer and")).toBe(true);
  });
  it("returns the typed text alone when nothing was heard", () => {
    expect(joinTranscript("Hello", [], "")).toBe("Hello");
    expect(joinTranscript("", [], "")).toBe("");
  });
});

describe("voice typing in the composer", () => {
  const src = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
  it("uses joinTranscript, not raw string concatenation", () => {
    expect(src).toContain("joinTranscript(");
    expect(src).not.toMatch(/\$\{finalText\}\$\{interim\}/);
  });
  it("stops listening when the box changes from outside (send, next question, restore)", () => {
    expect(src).toContain("lastEmittedRef");
    expect(src).toMatch(/value !== lastEmittedRef\.current[\s\S]{0,200}stopListening\(\)/);
  });
  it("ignores results from a stopped recognizer", () => {
    expect(src).toMatch(/recRef\.current !== rec\) return/);
  });
});

describe("Stage 1 greeting says the name aloud", () => {
  const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
  it("speaks the greeting with the first ask", () => {
    expect(intake).toContain("text: `${ASSIGNMENT_GREETING} ${ASSIGNMENT_ASK}`");
  });
});

describe("greeting pronunciation", () => {
  it("reads 'Hi, I'm Pau.' as 'Pow'", async () => {
    const { speakableSentences } = await import("@/lib/voice/speakable");
    const { ASSIGNMENT_GREETING } = await import("@/lib/stage1/chat-copy");
    const out = speakableSentences(`${ASSIGNMENT_GREETING} What's the assignment we're working on?`).join(" ");
    expect(out).toContain("Hi, I'm Pow.");
    expect(out).not.toContain("Pau");
    expect(out).toContain("What's the assignment we're working on?");
  });
});

describe("caret after a restored draft", () => {
  const src = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
  it("moves the caret to the end when the box is filled from outside", () => {
    expect(src).toMatch(/document\.activeElement !== ta\) ta\.setSelectionRange\(ta\.value\.length, ta\.value\.length\)/);
  });
});

describe("voice typing never repeats a phrase", () => {
  const src = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
  it("rebuilds from all results instead of appending from resultIndex", () => {
    expect(src).toMatch(/for \(let i = 0; i < event\.results\.length; i\+\+\)/);
    expect(src).not.toContain("finals.push(r[0].transcript);\n        else");
  });
});
