"use server";

import { redirect } from "next/navigation";
import { formatAuthError } from "@/lib/auth/messages";
import { getEmailConfirmRedirectTo } from "@/lib/auth/site-url";
import { clearDemoSession, setDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
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
