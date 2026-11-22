import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/site-url";
import { clearDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE / code exchange callback (and token_hash fallback).
 * Prefer /auth/confirm for email templates; keep this for OAuth and legacy links.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const errorParam =
    searchParams.get("error") || searchParams.get("error_code") || searchParams.get("error_description");
  const next = safeInternalPath(searchParams.get("next"));

  const isRecovery = type === "recovery" || next.startsWith("/reset-password");
  const fail = (code: string) =>
    NextResponse.redirect(
      isRecovery
        ? `${origin}/forgot-password?error=${encodeURIComponent(code)}`
        : `${origin}/login?error=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
    );

  if (errorParam) {
    return fail(searchParams.get("error_code") === "otp_expired" ? "otp_expired" : "access_denied");
  }

  if (!hasSupabaseConfig()) {
    return fail("auth");
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession", error.message);
      return fail("exchange_failed");
    }
    await clearDemoSession();
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      console.error("[auth/callback] verifyOtp", error.message);
      const codeName = error.message.toLowerCase().includes("expired")
        ? "otp_expired"
        : "exchange_failed";
      return fail(codeName);
    }
    await clearDemoSession();
    return NextResponse.redirect(`${origin}${next}`);
  }

  return fail("missing_token");
}
