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
});
