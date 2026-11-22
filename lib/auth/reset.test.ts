import { describe, expect, it } from "vitest";
import { parseRecoveryHash, resetErrorMessage } from "@/lib/auth/reset";

describe("parseRecoveryHash", () => {
  it("reads implicit-flow tokens", () => {
    expect(
      parseRecoveryHash("#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery"),
    ).toEqual({ kind: "session", accessToken: "a.b.c", refreshToken: "r1" });
  });
  it("reads an expired-link error", () => {
    expect(
      parseRecoveryHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid"),
    ).toEqual({ kind: "error", code: "otp_expired" });
  });
  it("ignores empty or partial fragments", () => {
    expect(parseRecoveryHash("")).toEqual({ kind: "none" });
    expect(parseRecoveryHash("#access_token=x")).toEqual({ kind: "none" });
  });
});

describe("resetErrorMessage", () => {
  it("offers a new link for every failure", () => {
    for (const code of ["otp_expired", "exchange_failed", "missing_token", "weird"]) {
      expect(resetErrorMessage(code)).toMatch(/new/);
    }
    expect(resetErrorMessage(null)).toBeNull();
  });
});
