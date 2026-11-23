import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed-in owner check for a paper. Returns the error response to send, or
 * null when the caller owns the paper. Kept separate so a route can start its
 * model call while this check runs, and drop the result if it fails.
 */
export async function paperOwnerDenied(paperId: string): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: paper } = await supabase.from("papers").select("id").eq("id", paperId).eq("user_id", user.id).maybeSingle();
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return null;
}

export const AUTH_COOKIE = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/i;

/** Cheap pre-check: only start an early model call when a session cookie is present. */
export async function hasAuthCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some((c) => AUTH_COOKIE.test(c.name));
}
