import "server-only";

import { cookies } from "next/headers";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Signed-in check for headers. Never redirects. */
export async function isSignedIn(): Promise<boolean> {
  // Read cookies first so pages with this header always render per request.
  await cookies();
  if (!hasSupabaseConfig()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}
