import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { __resetSpeech, speechArmed, takeNew, unlockSpeech } from "@/lib/voice/speech";

const g = globalThis as Record<string, unknown>;
afterEach(() => {
  delete g.window;
  vi.unstubAllGlobals();
  __resetSpeech();
});

describe("5:03 PM: an unlock tap never lets history into her queue", () => {
  it("a plain tap (unlock, Tap to hear, Voice switch) does not arm; restored turns stay silent", () => {
    __resetSpeech();
    g.window = { location: { pathname: "/app/papers/p/stage/1" } };
    expect(takeNew("p", [{ key: "a", text: "Old turn." }])).toEqual([]);
    unlockSpeech();
    expect(speechArmed()).toBe(false);
    expect(takeNew("p", [{ key: "a", text: "Old turn." }, { key: "late", text: "Restored late, after the tap." }])).toEqual([]);
  });
  it("the gesture listeners only unlock audio", () => {
    const src = readFileSync("lib/voice/speech.ts", "utf8");
    expect(src).toMatch(/const onGesture = \(\) => \{\n\s*unlockSpeech\(\);\n\s*\};/);
    expect(src).not.toMatch(/export function unlockSpeech\(\) \{\n\s*armSpeech/);
  });
  it("the save line keeps its height when idle (pinned composer)", () => {
    expect(readFileSync("components/stages/save-status.tsx", "utf8")).toMatch(/status === "idle"\) return <span aria-hidden className="inline-block h-\[20px\]/);
  });
});
