import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("signup confirmation screen", () => {
  it("does not offer demo mode after the account is created", () => {
    const form = readFileSync("components/auth/signup-form.tsx", "utf8");
    const noticeAt = form.indexOf("if (signUpState.notice)");
    const demoAt = form.indexOf("Continue in demo mode");
    expect(noticeAt).toBeGreaterThan(-1);
    expect(demoAt).toBeGreaterThan(noticeAt);
    expect(form.slice(noticeAt, demoAt)).toContain("return (");
    const actions = readFileSync("app/auth/actions.ts", "utf8");
    expect(actions).not.toContain("continue in demo mode to explore now");
  });
});
