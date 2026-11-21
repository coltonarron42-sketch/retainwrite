import { describe, expect, it } from "vitest";
import {
  FEATURES,
  HIDDEN_DRAFT_MODE,
  SKELETON_PEEKS,
} from "@/lib/config";

describe("drafting flags", () => {
  it("ships the three switches off until acceptance tests pass", () => {
    expect(FEATURES.draftingMuscle).toBe(false);
    expect(FEATURES.interactionLayer).toBe(false);
    expect(FEATURES.hiddenDraft).toBe(false);
    expect(HIDDEN_DRAFT_MODE).toBe("prose");
    expect(SKELETON_PEEKS).toBe(false);
  });
});
