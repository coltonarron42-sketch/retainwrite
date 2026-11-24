import { describe, expect, it } from "vitest";
import { addSpokenLine, outlineChoiceSaid, splitOutlineControl } from "@/lib/stages/outline-voice";
import { isSaidToCoach } from "@/lib/stage1/voice-turn";
import { isEcho } from "@/lib/voice/realtime/guard";
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

describe("Stage 3 voice: move-on words and requests", () => {
  it("takes trailing move-on clauses off their outline words", () => {
    expect(splitOutlineControl("My example is the Minnesota study where grades went up after schools started later. That's my outline for this section.")).toEqual({ line: "My example is the Minnesota study where grades went up after schools started later.", moveOn: true });
    expect(splitOutlineControl("I'll end by saying the bus costs are real, but student health matters more. That's it for this part.").line).toBe("I'll end by saying the bus costs are real, but student health matters more.");
    expect(splitOutlineControl("That's all I have for this section. Let's move on.")).toEqual({ line: "", moveOn: true });
    expect(splitOutlineControl("Later start times help teens sleep more.")).toEqual({ line: "Later start times help teens sleep more.", moveOn: false });
    expect(splitOutlineControl("Teens can't just move on from a bad night of sleep.").line).toBe("Teens can't just move on from a bad night of sleep.");
  });
  it("never saves a request to the coach", () => {
    expect(isSaidToCoach("Just give me one example outline line I can copy. For a different topic, pretend.")).toBe(true);
    expect(isSaidToCoach("Write my whole outline for this section")).toBe(true);
    expect(isSaidToCoach("Just write me a line.")).toBe(true);
    expect(isSaidToCoach("Write me a line for my intro.")).toBe(true);
    expect(isSaidToCoach("Can you give me a topic sentence?")).toBe(true);
    expect(isSaidToCoach("Okay, give me one line for the body.")).toBe(true);
  });
  it("keeps real content that happens to say 'give me' or 'make me'", () => {
    expect(isSaidToCoach("Give me a reason schools should start later: teens need sleep.")).toBe(false);
    expect(isSaidToCoach("Teachers always give me a thesis to defend, but this time I picked my own.")).toBe(false);
    expect(isSaidToCoach("Make me a believer: later starts mean fewer crashes.")).toBe(false);
    expect(isSaidToCoach("My main point is that later start times help teens sleep.")).toBe(false);
  });
  it("her reply repeating their words isn't an echo of them", () => {
    expect(isEcho("Keep my notes.", ["Keep my notes it is."], false)).toBe(true);
    // relay passes herRecent(id) without that reply, so nothing to match
    expect(isEcho("Keep my notes.", [""], false)).toBe(false);
  });
});

describe("Stage 3 voice: no empty 'just say yes' on a section", () => {
  it("the instructions say yes does nothing on a section", () => {
    const ins = buildStage3Instructions("Section 1 of 3: Introduction.");
    expect(ins).toMatch(/On a section, "yes" does nothing: never say "or just say yes" there/);
  });
});

describe("Stage 3 voice: wording", () => {
  const ins = buildStage3Instructions("Section 1 of 3: Introduction.");
  it("never claims to lock a section", () => {
    expect(ins).toMatch(/Never say "locking it in", "locked"/);
  });
  it("never asks them to repeat a line that's already in the box", () => {
    expect(ins).toMatch(/already in the box, word for word: never ask them to say it again/);
  });
});
