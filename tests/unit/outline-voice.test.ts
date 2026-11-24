import { describe, expect, it } from "vitest";
import { addSpokenLine, outlineChoiceSaid } from "@/lib/stages/outline-voice";
import { buildStage3Instructions } from "@/lib/voice/realtime/persona";
import { stage3Block } from "@/lib/voice/realtime/flow-state";

describe("Stage 3 voice", () => {
  it("spoken points replace the untouched notes prefill, then add lines verbatim", () => {
    expect(addSpokenLine("my stance note", " Main point:  teens need sleep ", "my stance note")).toBe("Main point: teens need sleep");
    expect(addSpokenLine("Main point", "example: my brother", "notes")).toBe("Main point\nexample: my brother");
    expect(addSpokenLine("", "first line", "")).toBe("first line");
    expect(addSpokenLine("x", "  ", "n")).toBe("x");
  });
  it("only the exact on-screen choice counts as tapping it", () => {
    expect(outlineChoiceSaid("Keep my notes.", true)).toBe(true);
    expect(outlineChoiceSaid("okay, just keep my notes", true)).toBe(true);
    expect(outlineChoiceSaid("keep my notes but add that buses cost money", true)).toBe(false);
    expect(outlineChoiceSaid("skip for now", true)).toBe(false);
    expect(outlineChoiceSaid("Skip for now.", false)).toBe(true);
  });
  it("persona: coaching only, their words only, one quip, no cartoon joke", () => {
    const s = buildStage3Instructions(stage3Block({ stage: 3, topic: "Start times", prompt: null, sections: [{ key: "intro", title: "Introduction", done: false }], current: { title: "Introduction", needs: "hook", notes: ["teens are tired"] } }), []);
    expect(s).toContain("Stage 3, Outline");
    expect(s).toContain("never write any part of their paper or their outline");
    expect(s).toContain("word for word");
    expect(s).toMatch(/never the cartoon joke/);
    expect(s).toContain('"teens are tired"');
  });
});
