import { NextResponse } from "next/server";
import { clearDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (code && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await clearDemoSession();
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
