import { describe, expect, it } from "vitest";
import { parsePasswordUpdatedSignal } from "@/lib/auth/password-updated-signal";

describe("parsePasswordUpdatedSignal", () => {
  it("accepts the signal as an object or JSON string", () => {
    const signal = { type: "password-updated", email: "a@b.co", at: 1 };
    expect(parsePasswordUpdatedSignal(signal)).toEqual(signal);
    expect(parsePasswordUpdatedSignal(JSON.stringify(signal))).toEqual(signal);
  });
  it("ignores anything else", () => {
    expect(parsePasswordUpdatedSignal("nope")).toBeNull();
    expect(parsePasswordUpdatedSignal({ type: "other", email: "a", at: 1 })).toBeNull();
    expect(parsePasswordUpdatedSignal(null)).toBeNull();
  });
});
