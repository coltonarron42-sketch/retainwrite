import { describe, expect, it } from "vitest";
import { formatAuthError } from "@/lib/auth/messages";

describe("formatAuthError", () => {
  it("explains unconfirmed email", () => {
    expect(formatAuthError("Email not confirmed")).toMatch(/Confirm your email/i);
  });

  it("explains bad credentials", () => {
    expect(formatAuthError("Invalid login credentials")).toMatch(/Incorrect email/i);
  });

  it("gives an honest wait for reset-email limits", () => {
    expect(
      formatAuthError("For security purposes, you can only request this after 42 seconds."),
    ).toBe("For security, wait 42 seconds before requesting another link.");
    expect(formatAuthError("email rate limit exceeded")).toMatch(/last hour/);
    expect(formatAuthError("Error sending recovery email")).toMatch(/couldn't send/);
  });
});
