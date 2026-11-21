import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("start paper", () => {
  it("logs the database message and rolls back when the profile update fails", () => {
    const source = readFileSync("lib/papers/account.ts", "utf8");
    expect(source).toMatch(/code: error\.code, message: error\.message/);
    expect(source).toMatch(/error: profileError/);
    const updateAt = source.indexOf("profile update failed");
    const okAt = source.lastIndexOf("return { ok: true, id }");
    const deleteAt = source.indexOf('.from("papers").delete()');
    expect(updateAt).toBeGreaterThan(0);
    expect(deleteAt).toBeGreaterThan(updateAt);
    expect(okAt).toBeGreaterThan(deleteAt);
    expect(source).not.toMatch(/service_role|GROK_API_KEY|password/i);
  });
});
