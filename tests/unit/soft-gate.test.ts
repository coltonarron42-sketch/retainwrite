import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GATE_OVERVIEW, gateNeed, gateParas, gateSpoken, SOFT_GATE_DEFAULT, SOFT_GATE_STAGE3 } from "@/lib/stages/soft-gate";

const relay = readFileSync("lib/voice/realtime/relay.ts", "utf8");
const route = readFileSync("app/api/voice/realtime/route.ts", "utf8");
const voice = readFileSync("components/stages/loop/realtime-voice.tsx", "utf8");

describe("soft gate copy (Stages 2-6): overview, then what we still need", () => {
  it("every gated stage has a short overview (1-2 sentences, at most one quip)", () => {
    for (const s of [2, 3, 4, 5, 6]) {
      const o = GATE_OVERVIEW[s]!;
      expect(o.length).toBeGreaterThan(40);
      expect((o.match(/[.!?](\s|$)/g) ?? []).length).toBeLessThanOrEqual(2);
      expect(o).not.toMatch(/Pau/);
    }
  });
  it("Stage 3 keeps Colton's line; others name the missing stage in the default line", () => {
    expect(gateNeed(3, 2)).toBe(SOFT_GATE_STAGE3);
    expect(gateNeed(4, 2)).toBe("We need a bit more info from an earlier stage (Stage 2: Stance) before we can start building here.");
    expect(gateNeed(3, 1)).toMatch(/\(Stage 1: Intake\)/);
    expect(gateNeed(2, 0)).toBe(SOFT_GATE_DEFAULT);
    expect(gateParas(3, 2)).toEqual([GATE_OVERVIEW[3], SOFT_GATE_STAGE3]);
  });
  it("the spoken line is the same words, without reading parentheses aloud", () => {
    expect(gateSpoken(4, 2)).toBe(`${GATE_OVERVIEW[4]} We need a bit more info from Stage 2, Stance, before we can start building here.`);
    expect(gateSpoken(3, 2)).toBe(`${GATE_OVERVIEW[3]} ${SOFT_GATE_STAGE3}`);
  });
  it("voice: scripted (server-side), once, speak-only; muted or voice off shows text only", () => {
    expect(route).toMatch(/stage > paperStage \? \{ stage, paperStage \} : undefined/);
    expect(relay).toMatch(/upSend\(say\(gateSpoken\(ctx\.gate\.stage, ctx\.gate\.paperStage\)\)\)/);
    expect(relay).toMatch(/turn_detection: ctx\.gate \|\| ctx\.vad === "client" \? null/);
    expect(relay).toMatch(/if \(dispatched\.has\(id\) \|\| closed \|\| ctx\.gate\) return;/);
    expect(voice).toMatch(/if \(!enabled \|\| spoken\.current \|\| !voiceWasOn\(\)\) return;/);
    expect(voice).toMatch(/sessionStorage\.getItem\(RT_MUTED_KEY\) !== "1"/);
  });
});

describe("way back + gate voice timeout (Nov 23, t158u)", () => {
  it("back buttons are plain full-load links, not client nav", () => {
    const gate = readFileSync("components/stages/soft-gate-view.tsx", "utf8");
    const shell = readFileSync("components/stages/stage-shell.tsx", "utf8");
    expect(gate).toMatch(/<a href=\{`\/app\/papers\/\$\{paperId\}\/stage\/\$\{paperStage\}`\} data-stage-back>/);
    expect(shell).toMatch(/<a href=\{backHref\} data-stage-back>/);
  });
  it("a gate line that never starts is dropped after GATE_CONNECT_MS", () => {
    const client = readFileSync("lib/voice/realtime/client.ts", "utf8");
    expect(client).toMatch(/GATE_CONNECT_MS = 8000/);
    expect(client).toMatch(/!this\.gateHeard\) \{\s*this\.on\.error\?\.\("gate_timeout"\);\s*this\.stop\(\);/);
  });
});
