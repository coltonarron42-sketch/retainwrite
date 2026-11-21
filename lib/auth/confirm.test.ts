import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confirmOutcome } from "@/lib/auth/confirm";

describe("email confirmation", () => {
  it("sends a used link to the app when a session or confirmed account already exists", () => {
    expect(
      confirmOutcome({
        verifyError: "Email link is invalid or has expired",
        hasSession: true,
        confirmed: false,
      }),
    ).toBe("app");
    expect(
      confirmOutcome({
        verifyError: "Email link is invalid or has expired",
        hasSession: false,
        confirmed: true,
      }),
    ).toBe("app");
    expect(
      confirmOutcome({
        verifyError: "Email link is invalid or has expired",
        hasSession: false,
        confirmed: false,
      }),
    ).toBe("otp_expired");
    expect(confirmOutcome({ verifyError: null, hasSession: false, confirmed: false })).toBe("next");
  });

  it("does not verify the token while rendering the confirm page", () => {
    expect(existsSync("app/auth/confirm/route.ts")).toBe(false);
    const page = readFileSync("app/auth/confirm/page.tsx", "utf8");
    const action = readFileSync("app/auth/confirm/actions.ts", "utf8");
    expect(page).toContain("Confirm my email");
    expect(page).not.toMatch(/verifyOtp\s*\(/);
    expect(action).toContain("verifyOtp");
    expect(action).toContain('redirect("/app")');
    expect(action).not.toContain("console.error(token");
  });
});