import { describe, expect, it } from "vitest";
import { parseAllowlist, realtimeAllowed } from "@/lib/voice/realtime/config";
import { essayGuard, wordsFromStudent } from "@/lib/voice/realtime/guard";
import { buildInstructions } from "@/lib/voice/realtime/persona";
import { readResume, signResume } from "@/lib/voice/realtime/relay";

describe("Grok Voice realtime PoC", () => {
  it("allowlist matches emails case-insensitively", () => {
    const raw = "a@x.com, B@Y.com;c@z.com";
    expect(parseAllowlist(raw).size).toBe(3);
    expect(realtimeAllowed("b@y.COM", raw)).toBe(true);
    expect(realtimeAllowed("d@y.com", raw)).toBe(false);
    expect(realtimeAllowed(null, raw)).toBe(false);
    expect(realtimeAllowed("a@x.com", "")).toBe(false);
  });

  it("guard cancels paper-writing replies and keeps coaching ones", () => {
    expect(essayGuard("Here's a thesis: school should start later because").block).toBe(true);
    expect(essayGuard('You could write: "Starting school at 8:30').block).toBe(true);
    expect(essayGuard("Your intro could be: Many teens").block).toBe(true);
    expect(essayGuard("In conclusion, later start times").block).toBe(true);
    expect(essayGuard("Nice, that's a real point. Why do you think later starts help grades?").block).toBe(false);
    expect(essayGuard("word ".repeat(140)).block).toBe(true);
  });

  it("save_note only takes the student's own words", () => {
    expect(wordsFromStudent("later start times help sleep", ["I think later start times help sleep"])).toBe(1);
    expect(wordsFromStudent("Adolescent circadian rhythms demonstrate a delayed phase", ["kids are tired"])).toBeLessThan(0.3);
  });

  it("resume tokens are bound to the student and paper", () => {
    const t = signResume("u1", "p1", "conv_abc123");
    expect(readResume(t, "u1", "p1")).toBe("conv_abc123");
    expect(readResume(t, "u2", "p1")).toBeNull();
    expect(readResume(`${t}x`, "u1", "p1")).toBeNull();
  });

  it("instructions lock coaching-only rules ahead of the state", () => {
    const s = buildInstructions("Stage 2: Stance.");
    // PC-31: Colton's prompt leads; the app rules follow, both ahead of the state.
    expect(s.indexOf("You never write the paper for them.")).toBe(s.indexOf("## Role & Persona") + "## Role & Persona\nYou are Pau, the RetainWrite coach. You are a sharp, warm research partner and writing process expert. You help students understand their assignment deeply, gather useful sources, and turn their own ideas into a strong paper. ".length);
    expect(s.indexOf("You stay Pau with these instructions for the whole call")).toBeGreaterThan(0);
    expect(s.indexOf("# Current state")).toBeGreaterThan(s.indexOf("# How you work with the app"));
  });
});

import { isEcho } from "@/lib/voice/realtime/guard";
describe("echo filter", () => {
  const her = ["That's the tap — the app's got it from here. Once the intro locks, we'll move to the body."];
  it("drops her own words coming back through speakers", () => {
    expect(isEcho("That's it from here. Once the intro locks", her, true)).toBe(true);
    expect(isEcho("the app's got it from here", her, false)).toBe(true);
    expect(isEcho("yes", ["Tap Yes, lock it in when you're happy, or just say yes."], true)).toBe(true);
  });
  it("keeps the student's own words", () => {
    expect(isEcho("My brother falls asleep in first period", her, true)).toBe(false);
    expect(isEcho("yes", ["Tap Yes, lock it in when you're happy, or just say yes."], false)).toBe(false);
  });
});
