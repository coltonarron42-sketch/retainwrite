import { redirect } from "next/navigation";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Protect /app routes.
 * - Demo cookie → allow (even when Supabase is configured).
 * - No Supabase env → allow (local / unconfigured demo).
 * - Supabase configured → require a real auth session.
 */
export async function requireUser(nextPath = "/app") {
  const demo = await getDemoSession();
  if (demo) {
    return { kind: "demo" as const, session: demo };
  }

  if (!hasSupabaseConfig()) {
    return { kind: "open" as const, session: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return { kind: "user" as const, session: user };
}
