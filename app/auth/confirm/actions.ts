"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { confirmOutcome, isEmailOtpType } from "@/lib/auth/confirm";
import { safeInternalPath } from "@/lib/auth/site-url";
import { clearDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** POST only. Email scanners that GET the link must not burn the token. */
export async function confirmEmail(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "");
  const isRecovery = type === "recovery";
  const next = isRecovery ? "/reset-password" : safeInternalPath(String(formData.get("next") ?? "/app"));
  const login = (code: string): never => {
    if (isRecovery) redirect(`/forgot-password?error=${encodeURIComponent(code)}`);
    redirect(`/login?error=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
  };

  if (!tokenHash || !isEmailOtpType(type)) login("missing_token");
  if (!hasSupabaseConfig()) login("auth");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const outcome = confirmOutcome({
    verifyError: error?.message ?? null,
    hasSession: Boolean(user),
    confirmed: Boolean(user?.email_confirmed_at),
  });

  if (outcome === "next") {
    await clearDemoSession();
    redirect(next);
  }
  // A signed-in browser can still set a new password from a used recovery link.
  if (outcome === "app") {
    if (isRecovery && user) redirect("/reset-password");
    redirect("/app");
  }

  console.error("[auth/confirm]", error?.message ?? "verify_failed");
  login(outcome);
}
