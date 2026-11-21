import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FEATURES,
  HIDDEN_DRAFT_MODE,
  SKELETON_PEEKS,
  STAGE_LABELS,
} from "@/lib/config";

describe("drafting flags", () => {
  it("ships the three switches off until acceptance tests pass", () => {
    expect(FEATURES.draftingMuscle).toBe(false);
    expect(FEATURES.interactionLayer).toBe(false);
    expect(FEATURES.hiddenDraft).toBe(false);
    expect(HIDDEN_DRAFT_MODE).toBe("prose");
    expect(SKELETON_PEEKS).toBe(false);
  });

  it("names the stage Drafting in student-facing copy", () => {
    expect(STAGE_LABELS[4]).toBe("Drafting");
    const how = readFileSync("components/marketing/how-it-works.tsx", "utf8");
    expect(how).toContain('title: "Drafting"');
    expect(how).not.toMatch(/title: "Draft"/);
    expect(how).not.toContain("Draft stage");
    expect(how).not.toContain("Stage 3");
  });
});
