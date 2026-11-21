import { describe, expect, it } from "vitest";
import { resolveReaderMode } from "@/lib/auth/reader-mode";

describe("resolveReaderMode", () => {
  it("uses the live reader for a signed-in student even with a demo cookie", () => {
    expect(resolveReaderMode({ authenticated: true, demoSession: true })).toBe("live");
    expect(resolveReaderMode({ authenticated: true, demoSession: false })).toBe("live");
  });

  it("allows demo fallback only for an anonymous demo session", () => {
    expect(resolveReaderMode({ authenticated: false, demoSession: true })).toBe("demo");
    expect(resolveReaderMode({ authenticated: false, demoSession: false })).toBe("live");
  });
});
