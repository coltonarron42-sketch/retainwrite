import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  getEmailConfirmRedirectTo,
  safeInternalPath,
} from "@/lib/auth/site-url";

describe("auth site url helpers", () => {
  it("keeps internal next paths safe", () => {
    expect(safeInternalPath("/app")).toBe("/app");
    expect(safeInternalPath("//evil.com")).toBe("/app");
    expect(safeInternalPath("https://evil.com")).toBe("/app");
  });

  it("builds confirm redirect on retainwrite.com", () => {
    const url = getEmailConfirmRedirectTo("/app");
    expect(url).toContain("/auth/confirm?");
    expect(url).toContain("next=%2Fapp");
    expect(url.startsWith("https://")).toBe(true);
  });

  it("maps error codes to visible copy", () => {
    expect(authErrorMessage("otp_expired")).toMatch(/expired/i);
    expect(authErrorMessage("exchange_failed")).toMatch(/couldn't verify|could not verify|fresh/i);
  });
});
