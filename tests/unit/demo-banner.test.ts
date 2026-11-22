import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("demo loss banner", () => {
  it("warns that demo work is not copied and can be dismissed per page", () => {
    const banner = readFileSync("components/app/demo-loss-banner.tsx", "utf8");
    expect(banner).toContain("Create a free account");
    expect(banner.replace(/\s+/g, " ")).toContain("demo work is not copied over");
    expect(banner).toContain("rw_demo_banner:");
    const layout = readFileSync("app/app/layout.tsx", "utf8");
    expect(layout).toContain("access.kind !== \"user\"");
    expect(layout).toContain("DemoLossBanner");
  });

  it("gives demo sessions an Exit demo control that runs the sign-out action", () => {
    const layout = readFileSync("app/app/layout.tsx", "utf8");
    expect(layout).toContain('label="Exit demo"');
    expect(layout).toContain('access.kind === "demo"');
    const button = readFileSync("components/auth/log-out-button.tsx", "utf8");
    expect(button).toContain("signOutAction");
    const actions = readFileSync("app/auth/actions.ts", "utf8");
    const signOut = actions.slice(actions.indexOf("export async function signOutAction"));
    expect(signOut).toContain("clearDemoSession()");
    expect(signOut).toContain('redirect("/")');
  });
});
