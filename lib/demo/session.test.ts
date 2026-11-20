import { describe, expect, it } from "vitest";
import {
  createDemoSession,
  parseDemoSession,
  serializeDemoSession,
} from "@/lib/demo/session";

describe("demo session helpers", () => {
  it("creates a session with defaults", () => {
    const session = createDemoSession();
    expect(session.email).toBe("demo@retainwrite.com");
    expect(session.displayName).toBe("Demo Student");
    expect(session.createdAt).toBeTruthy();
  });

  it("round-trips through serialize/parse", () => {
    const session = createDemoSession({
      email: "Alex@School.edu",
      displayName: "Alex",
    });
    expect(session.email).toBe("alex@school.edu");
    const raw = serializeDemoSession(session);
    expect(parseDemoSession(raw)).toEqual(session);
  });

  it("returns null for invalid payloads", () => {
    expect(parseDemoSession(null)).toBeNull();
    expect(parseDemoSession("not-json")).toBeNull();
    expect(parseDemoSession("{}")).toBeNull();
  });
});
