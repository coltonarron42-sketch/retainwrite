import { describe, expect, it } from "vitest";
import { newerDraftText } from "@/lib/papers/local-draft";

describe("newerDraftText", () => {
  it("uses the server copy when there is no local copy", () => {
    expect(newerDraftText(null, { text: "server", updatedAt: "2026-11-21T10:00:00Z" })).toBe("server");
  });
  it("uses the local copy when the server has none", () => {
    expect(newerDraftText({ text: "local", at: 1 }, null)).toBe("local");
  });
  it("prefers the newer of the two", () => {
    const at = Date.parse("2026-11-21T10:00:00Z");
    expect(newerDraftText({ text: "local", at: at + 1000 }, { text: "server", updatedAt: "2026-11-21T10:00:00Z" })).toBe("local");
    expect(newerDraftText({ text: "local", at: at - 1000 }, { text: "server", updatedAt: "2026-11-21T10:00:00Z" })).toBe("server");
  });
  it("returns empty when neither has text", () => {
    expect(newerDraftText(null, { text: "  " })).toBe("");
  });
});
