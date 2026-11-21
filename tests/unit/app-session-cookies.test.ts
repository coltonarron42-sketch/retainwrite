import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("logged-in /app does not write cookies during render", () => {
  it("keeps requireUser from deleting the demo cookie in a Server Component", () => {
    const source = readFileSync("lib/auth/require-user.ts", "utf8");
    expect(source).not.toContain("clearDemoSession");
    expect(source).not.toContain("cookies(");
  });

  it("swallows Supabase setAll and demo-cookie deletes outside a route", () => {
    const server = readFileSync("lib/supabase/server.ts", "utf8");
    const demo = readFileSync("lib/demo/session-server.ts", "utf8");
    expect(server).toContain("setAllServerCookies");
    expect(demo).toContain("mutateCookie");
  });

  it("refreshes the session in proxy.ts, not the deprecated middleware file", () => {
    const proxy = readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("export async function proxy");
    expect(proxy).toContain("updateSession");
    expect(proxy).not.toContain("export function middleware");
    expect(() => readFileSync("middleware.ts", "utf8")).toThrow();
  });
});
