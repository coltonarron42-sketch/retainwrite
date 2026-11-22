"use server";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { formatAuthError } from "@/lib/auth/messages";
import { getAuthSiteUrl, getEmailConfirmRedirectTo } from "@/lib/auth/site-url";
import { clearDemoSession, setDemoSession } from "@/lib/demo/session-server";
import { getPublicEnv, hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  notice?: string;
};

function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "/app";
  if (!value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
}

function readPassword(formData: FormData): string {
  return String(formData.get("password") ?? "");
}

export async function startDemoSessionAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readEmail(formData) || "demo@retainwrite.com";
  await setDemoSession({ email });
  redirect(safeNext(formData.get("next")));
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readEmail(formData);
  const password = readPassword(formData);
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter an email and password." };
  }

  if (!hasSupabaseConfig()) {
    await setDemoSession({ email });
    redirect(next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  await clearDemoSession();
  redirect(next);
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readEmail(formData);
  const password = readPassword(formData);
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter an email and password." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (!hasSupabaseConfig()) {
    await setDemoSession({ email });
    redirect(next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Must be allow-listed in Supabase Auth → Redirect URLs.
      // Template should use token_hash → /auth/confirm on our domain.
      emailRedirectTo: getEmailConfirmRedirectTo(next),
    },
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  // Supabase answers a repeat signup for an existing email with a fake user
  // (no identities) and sends no email. Say so instead of "check your email".
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      error:
        "An account with this email already exists, so no new email was sent. Log in, or reset your password.",
    };
  }

  // Email confirmation required: no session until the user verifies.
  if (!data.session) {
    return {
      notice:
        "Check your email for a confirmation link from RetainWrite. Open it in Safari or Chrome, not only the mail app’s preview.",
    };
  }

  await clearDemoSession();
  redirect(next);
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readEmail(formData);
  if (!email) return { error: "Enter your email." };
  if (!hasSupabaseConfig()) return { error: "Password reset is unavailable right now." };

  // Not the cookie-bound server client: that one uses PKCE, so the link only
  // worked in the browser that asked for it. Phones open mail links in a
  // different browser. Implicit flow puts the session in the link itself.
  const env = getPublicEnv();
  const supabase = createSupabaseJsClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAuthSiteUrl()}/auth/reset`,
  });
  if (error) return { error: formatAuthError(error.message) };
  return {
    notice:
      "If that email has an account, a reset link is on its way from coach@send.retainwrite.com. It can take a minute. Check spam or junk, and use the newest email if you asked more than once. You can open it on any device.",
  };
}

/** Turn the tokens from a reset link into this browser's cookie session. */
export async function establishRecoverySessionAction(
  accessToken: string,
  refreshToken: string,
): Promise<{ ok: boolean }> {
  if (!accessToken || !refreshToken || !hasSupabaseConfig()) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    console.error("[auth/reset] setSession", error.message);
    return { ok: false };
  }
  await clearDemoSession();
  return { ok: true };
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = readPassword(formData);
  const confirm = String(formData.get("confirm_password") ?? "");
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "The two passwords don't match. Type the same one twice." };
  if (!hasSupabaseConfig()) return { error: "Password reset is unavailable right now." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "That reset link has expired. Request a new one from Forgot password." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: formatAuthError(error.message) };

  // Prove the new password works for a fresh login before saying it saved.
  const env = getPublicEnv();
  const probe = createSupabaseJsClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: loginError } = await probe.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (loginError) {
    console.error("[auth/reset] new password failed verification", loginError.message);
    return { error: "Your new password didn't save. Try again, or request a new reset link." };
  }
  await probe.auth.signOut({ scope: "local" });
  // Global sign-out: ends every session for this user (other browsers and
  // devices that may know the old password) and this email-window session.
  // They log in again where they started, with the password they just set.
  await supabase.auth.signOut({ scope: "global" });
  await clearDemoSession();
  redirect(`/password-updated?email=${encodeURIComponent(user.email)}`);
}

/** Sign out this browser (clears the auth cookies) and go home. */
export async function signOutAction() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  await clearDemoSession();
  redirect("/");
}
