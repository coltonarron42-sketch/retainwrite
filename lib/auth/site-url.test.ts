import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  getAuthSiteUrl,
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
    expect(url).not.toContain("localhost");
  });

  it("ignores a localhost site url and uses the production origin", () => {
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const previousVercel = process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    delete process.env.VERCEL_URL;
    expect(getAuthSiteUrl()).toBe("https://www.retainwrite.com");
    expect(getEmailConfirmRedirectTo("/app")).not.toContain("localhost");
    if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    if (previousVercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousVercel;
  });

  it("maps error codes to visible copy", () => {
    expect(authErrorMessage("otp_expired")).toMatch(/expired/i);
    expect(authErrorMessage("exchange_failed")).toMatch(/couldn't verify|could not verify|fresh/i);
  });
});
