/** Round 6 (QA prod smoke on 5d7aca1): the gate lists every chosen style; voice-amount lines in Pau's first person. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chosenStyles } from "@/lib/stage1/north-turns";
import { northstarChecklist } from "@/lib/stage1/intake-resume";
import * as notes from "@/lib/copy/voiceNotes";

const decision = (styles: string[] | undefined, style?: string) =>
  northstarChecklist({ confirmed: true, catchUpDone: true, decided: true, stanceOk: true, styles, style, leader: "Walton" })[2]!.label;

describe("gate decision line lists every chosen style", () => {
  it("servant and transformational, with the leader", () => {
    expect(decision(["servant", "transformational"])).toBe("Decision made, with your reason: your styles: servant and transformational, your leader: Walton");
  });
  it("one style stays singular; the old single-style input still works", () => {
    expect(decision(["Servant"])).toBe("Decision made, with your reason: your style: servant, your leader: Walton");
    expect(decision(undefined, "servant")).toBe("Decision made, with your reason: your style: servant, your leader: Walton");
  });
  it("chosenStyles: from every answer about the pick, in order, never only the first", () => {
    expect(chosenStyles(["Servant because Walton listened to his workers.", "I'd also say transformational leadership, he sold a vision."])).toEqual(["servant", "transformational"]);
    expect(chosenStyles(["servant and transformational leadership"])).toEqual(["servant", "transformational"]);
  });
  it("a style they argue against isn't chosen", () => {
    expect(chosenStyles(["Servant works better than transformational for this."])).toEqual(["servant"]);
    expect(chosenStyles(["I'd go servant, not transformational."])).toEqual(["servant"]);
  });
  it("the intake gate passes every style (not .find on the decision alone)", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toMatch(/styles: \(\(\) => \{\s*const all = chosenStyles\(/);
  });
});

describe("voice-amount lines are Pau speaking (first person)", () => {
  const lines = [...(Object.values(notes) as unknown[]).filter((v): v is string => typeof v === "string")];
  it("no 'the coach', 'Pau', 'us' or 'we'", () => {
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const l of lines) {
      expect(l).not.toMatch(/\b(the coach|Pau|us|we|We)\b/);
      expect(l).toMatch(/\b(I|I'll|me)\b/);
    }
  });
  it("PC-32: the Stage 1 gate has no voice sample line at all", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).not.toMatch(/match your voice/);
    expect(src).not.toMatch(/Voice sample/);
  });
});
