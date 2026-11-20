import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authErrorMessage, safeInternalPath } from "@/lib/auth/site-url";
import { clearDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Token-hash confirmation endpoint.
 * Email templates should link here (own domain) instead of supabase.co/auth/v1/verify
 * so Safari ITP and Gmail's in-app browser don't break the flow.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeInternalPath(searchParams.get("next"));
  const loginError = (code: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
    );

  if (!hasSupabaseConfig()) {
    return loginError("auth");
  }

  if (!token_hash || !type) {
    return loginError("missing_token");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    const code = error.message.toLowerCase().includes("expired")
      ? "otp_expired"
      : "exchange_failed";
    // Surface a readable message in logs without leaking tokens.
    console.error("[auth/confirm]", error.message);
    void authErrorMessage(code);
    return loginError(code);
  }

  await clearDemoSession();
  return NextResponse.redirect(`${origin}${next}`);
}
