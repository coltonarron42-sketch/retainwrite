import { NextResponse } from "next/server";
import { ensureUserPaper } from "@/lib/papers/account";
import { betaCreditBypass } from "@/lib/papers/beta-bypass";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skipCredits = betaCreditBypass(user.email);
  if (skipCredits) console.info("[papers] beta_credit_bypass");
  const created = await ensureUserPaper(supabase, user.id, undefined, { skipCredits });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  return NextResponse.json({ id: created.id, current_stage: 1 });
}
