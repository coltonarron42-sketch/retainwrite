import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertServerEnv, getPublicEnv, hasSupabaseConfig } from "@/lib/env";
import { setAllServerCookies } from "@/lib/supabase/server-cookies";

export async function createClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured");
  }
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          setAllServerCookies(
            ({ name, value, options }) => cookieStore.set(name, value, options),
            cookiesToSet,
          );
        },
      },
    },
  );
}

export function createServiceRoleClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured");
  }
  const publicEnv = getPublicEnv();
  const server = assertServerEnv();
  if (!server.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createServiceClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    server.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
