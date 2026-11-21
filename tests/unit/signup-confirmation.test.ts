import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("signup confirmation screen", () => {
  it("does not offer demo mode after the account is created", () => {
    const form = readFileSync("components/auth/signup-form.tsx", "utf8");
    const noticeAt = form.indexOf("if (signUpState.notice)");
    expect(noticeAt).toBeGreaterThan(-1);
    expect(form).not.toContain("Continue in demo mode");
    const actions = readFileSync("app/auth/actions.ts", "utf8");
    expect(actions).not.toContain("continue in demo mode to explore now");
    expect(form).toContain("already signed in");
    expect(form).not.toContain("After you confirm, sign in");
    const start = readFileSync("components/app/new-paper-flow.tsx", "utf8");
    expect(start).toContain("Try again");
    expect(start).toContain("Back to your papers");
  });
});
