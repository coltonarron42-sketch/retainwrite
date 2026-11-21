import { describe, expect, it } from "vitest";
import {
  acceptMemoryFollowUp,
  assertGentleInvitation,
  HEAVY_DEFLECTION,
  MEMORY_TRIGGERS,
  safetyNoteFor,
  SCRIPTED_MEMORY_FOLLOW_UP,
  triggerMatchesBannedTopic,
  triggersForStudent,
} from "@/lib/coaching/memoryTriggers";

describe("memory triggers (t52)", () => {
  it("keeps every bank line a gentle invitation", () => {
    for (const trigger of MEMORY_TRIGGERS) {
      expect(assertGentleInvitation(trigger.line), trigger.id).toEqual({ ok: true });
      expect(triggerMatchesBannedTopic(trigger)).toBe(false);
    }
  });

  it("rejects a yes/no opener", () => {
    const line = ["Did you", " lose a tooth?"].join("");
    expect(assertGentleInvitation(line).ok).toBe(false);
  });

  it("falls back when a model follow-up interrogates", () => {
    const rejected = acceptMemoryFollowUp("Did you lose a tooth when you were little?");
    expect(rejected.rejected).toBe(true);
    expect(rejected.line).toBe(SCRIPTED_MEMORY_FOLLOW_UP);
    const were = acceptMemoryFollowUp("Were you scared that day?");
    expect(were.rejected).toBe(true);
    expect(were.line).toBe(SCRIPTED_MEMORY_FOLLOW_UP);
  });

  it("hides medium triggers from under-18 students and from the first set", () => {
    const first = triggersForStudent({ under18: false, refresh: 0 });
    expect(first).toHaveLength(4);
    expect(first.every((trigger) => trigger.sensitivity === "light")).toBe(true);
    const minor = triggersForStudent({ under18: true, refresh: 2 });
    expect(minor.every((trigger) => trigger.sensitivity !== "medium")).toBe(true);
    expect(minor.map((trigger) => trigger.id)).not.toContain("family_job");
    expect(minor.map((trigger) => trigger.id)).not.toContain("got_hurt");
  });

  it("offers Not this one by dropping a hidden chip and keeps a safety note text-free", () => {
    const hidden = triggersForStudent({
      under18: false,
      refresh: 0,
      hiddenIds: ["first_time"],
    });
    expect(hidden.map((trigger) => trigger.id)).not.toContain("first_time");
    const safety = safetyNoteFor("I want to die and I don't know what to do");
    expect(safety.show).toBe(true);
    expect(safety.event).toBe("memory_safety_note_shown");
    expect(safety.detail).toEqual({});
    expect(safety.note).toMatch(/988/);
    expect(safety.note).toMatch(/trusted adult/i);
    expect(HEAVY_DEFLECTION).toMatch(/different moment/i);
  });
});
