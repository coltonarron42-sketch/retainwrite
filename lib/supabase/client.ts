import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv, hasSupabaseConfig } from "@/lib/env";

export function createClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured");
  }
  const env = getPublicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
