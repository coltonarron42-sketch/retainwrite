"use server";

import { redirect } from "next/navigation";
import { formatAuthError } from "@/lib/auth/messages";
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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.retainwrite.com";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  // Email confirmation required: no session until the user verifies.
  if (!data.session) {
    return {
      notice:
        "Check your email to confirm your account, then log in. Or continue in demo mode to explore now.",
    };
  }

  await clearDemoSession();
  redirect(next);
}
