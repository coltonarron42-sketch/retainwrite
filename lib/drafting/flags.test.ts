import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FEATURES,
  HIDDEN_DRAFT_MODE,
  SKELETON_PEEKS,
  STAGE_LABELS,
} from "@/lib/config";

describe("drafting flags", () => {
  it("turns the Drafting switches on after the acceptance tests pass", () => {
    expect(FEATURES.draftingMuscle).toBe(true);
    expect(FEATURES.interactionLayer).toBe(true);
    expect(FEATURES.hiddenDraft).toBe(true);
    expect(HIDDEN_DRAFT_MODE).toBe("prose");
    expect(SKELETON_PEEKS).toBe(false);
  });

  it("names the stage Drafting in student-facing copy", () => {
    expect(STAGE_LABELS[4]).toBe("Drafting");
    const how = readFileSync("components/marketing/how-it-works.tsx", "utf8");
    // Colton, Nov 24 12:18 AM: public copy has no stage list or count; in-app labels stay.
    expect(how).not.toMatch(/six (gated )?stages|Stage \d/i);
    expect(how).not.toMatch(/title: "Draft"/);
    expect(how).not.toContain("Draft stage");
    expect(how).not.toContain("Stage 3");
  });
});
