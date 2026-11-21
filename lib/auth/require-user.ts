import { redirect } from "next/navigation";
import { clearDemoSession, getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Protect /app routes.
 * A real Supabase session wins over a leftover demo cookie.
 * Demo cookie → anonymous demo. No Supabase env → local demo.
 * Otherwise require a real auth session.
 */
export async function requireUser(nextPath = "/app") {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await clearDemoSession();
      return { kind: "user" as const, session: user };
    }
  }

  const demo = await getDemoSession();
  if (demo) {
    return { kind: "demo" as const, session: demo };
  }

  if (!hasSupabaseConfig()) {
    return { kind: "open" as const, session: null };
  }

  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}
