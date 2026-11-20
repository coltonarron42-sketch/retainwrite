import { describe, expect, it } from "vitest";
import { formatAuthError } from "@/lib/auth/messages";

describe("formatAuthError", () => {
  it("explains unconfirmed email", () => {
    expect(formatAuthError("Email not confirmed")).toMatch(/Confirm your email/i);
  });

  it("explains bad credentials", () => {
    expect(formatAuthError("Invalid login credentials")).toMatch(/Incorrect email/i);
  });
});
