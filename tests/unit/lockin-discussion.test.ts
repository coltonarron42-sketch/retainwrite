import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discussionLine, isSwapNo, isSwapYes, replacementText, SWAP_ASK } from "@/lib/stages/stance-turn";
import { buildInstructions } from "@/lib/voice/realtime/persona";

const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
const relay = readFileSync("lib/voice/realtime/relay.ts", "utf8");

describe("lock-in turn: new ideas are discussion, a replacement needs a swap yes", () => {
  it("finds only clear replacements", () => {
    expect(replacementText("change it to later start times help grades")).toBe("Later start times help grades");
    expect(replacementText("Actually my point is that sleep matters more than grades")).toBe("Sleep matters more than grades");
    expect(replacementText("Okay so change my note to the cost is worth it")).toBe("The cost is worth it");
    expect(replacementText("I also think buses matter a lot")).toBeNull();
    expect(replacementText("actually that sounds good")).toBeNull();
    expect(replacementText("change it")).toBeNull();
  });
  it("reads the answer to the swap question", () => {
    for (const y of ["yes", "yes, swap it", "yeah please", "swap it in", "sure"]) expect(isSwapYes(y)).toBe(true);
    for (const n of ["no keep it", "yes but wait", "don't"]) expect(isSwapYes(n)).toBe(false);
    expect(isSwapNo("no, keep the old one")).toBe(true);
    expect(SWAP_ASK).toBe("Want me to swap that in?");
    expect(discussionLine(1)).toMatch(/change it to/);
  });
  it("typed and spoken take the same path: the swap yes comes before the lock-in yes, and other words never save", () => {
    const swapAt = chat.indexOf("if (noteTurn && pending)");
    const yesAt = chat.indexOf("if (choiceTurn && yes)");
    expect(swapAt).toBeGreaterThan(0);
    expect(swapAt).toBeLessThan(yesAt);
    expect(chat).not.toMatch(/\{ replace: true, text \}/);
    expect(chat).toMatch(/return "swap_ask"/);
    expect(chat).toMatch(/return "discussion"/);
  });
  it("voice: she never asks the swap herself; the relay says the app's question once", () => {
    expect(buildInstructions("x")).toMatch(/Never ask that yourself/);
    expect(relay).toMatch(/e\.result === "swap_ask"/);
    expect(relay).toMatch(/upSend\(say\(SWAP_ASK\)\)/);
  });
});

describe("low priority: cut-off, stale note, late prompt", () => {
  it("no wrap-up after a cut-off", () => {
    expect(relay).toMatch(/r\?\.status !== "cancelled" && !speechActive && \(names\.includes/);
    expect(relay).toMatch(/You were just cut off mid-reply/);
  });
  it("spoken words after a lock-in never land in the box", () => {
    expect(chat).toMatch(/if \(fromVoice\) return "tap_needed";\n\s+restore\(\);/);
  });
  it("a late choice prompt is dropped", () => {
    expect(relay).toMatch(/speechActive \|\| speechAt > asked0\) return;\n\s+if \(choicesNow\(\)\.join\("\|"\) !== choices0 \|\| Date\.now\(\) - asked0 > 8_000\) return;/);
  });
});
