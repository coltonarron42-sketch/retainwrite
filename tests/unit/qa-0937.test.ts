/** QA 9:37 AM round-4 bundle. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wellKnownWork } from "@/lib/stage1/well-known";
import { materialGateLabel, northstarChecklist } from "@/lib/stage1/intake-resume";

describe("TOP: well-known works get a deterministic, labeled summary", () => {
  it("Goleman always lists the five EI components", () => {
    const w = wellKnownWork("the assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
    expect(w?.points.join(" ")).toMatch(/self-awareness, self-regulation, motivation, empathy, and social skill/);
  });
  it("Northouse is book level, never a chapter's contents", () => {
    const w = wellKnownWork("Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice)");
    expect(w?.bookLevel).toBe(true);
    expect(w?.points.join(" ")).not.toMatch(/chapter\s*\d/i);
  });
  it("obscure handouts are not in the catalog (she still won't guess)", () => {
    expect(wellKnownWork("Notes on the Quiet Kitchen")).toBeNull();
  });
  it("investigate uses the catalog and a short cap for known works", () => {
    const src = readFileSync("lib/server/paper-context/brief.ts", "utf8");
    expect(src).toContain("cat ? 7_000 : 28_000");
    expect(src).toContain("knowledge: catKnowledge");
  });
  it("the pre-confirm catch-up renders the material panel with its buttons", () => {
    expect(readFileSync("components/stages/stage1/pau-pau-confirm.tsx", "utf8")).toContain("data-confirm-material");
  });
});

describe("2. gate material state is accurate", () => {
  it("names the source, a pass, or waiting", () => {
    expect(materialGateLabel({ catchUpDone: true, materialShown: true, kinds: ["knowledge"], materialAnswer: "I haven't read it yet" })).toBe("Material: caught up from general knowledge (not your copy yet)");
    expect(materialGateLabel({ catchUpDone: true, materialShown: true, kinds: ["reading"] })).toBe("Material: caught up from your own reading");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "I read both of them" })).toBe("Material: caught up (you read it yourself)");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "I haven't read it yet" })).toBe("Material: waiting on the readings");
    const items = northstarChecklist({ confirmed: true, catchUpDone: true, decided: true, stanceOk: true, materialLabel: "Material: waiting on the readings" });
    expect(items[1]!.done).toBe(false);
  });
});
