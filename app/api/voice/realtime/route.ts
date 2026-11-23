import { NextResponse } from "next/server";
import { upgradeWebSocket } from "@vercel/functions";
import { z } from "zod";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv, hasSupabaseConfig } from "@/lib/env";
import { realtimeAllowed } from "@/lib/voice/realtime/config";
import { runRelay } from "@/lib/voice/realtime/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel Pro cap; the relay rotates the socket (with resumption) before it. */
export const maxDuration = 800;

/**
 * Grok Voice realtime relay (Stage 2 PoC, flag-gated).
 * GET without Upgrade: { enabled } for this student and paper.
 * GET with Upgrade: the WebSocket relay to xAI. The key stays here.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paperId = url.searchParams.get("paperId") ?? "";
  const upgrade = request.headers.get("upgrade")?.toLowerCase() === "websocket";
  const no = (status: number, error: string) => (upgrade ? new Response(error, { status }) : NextResponse.json({ enabled: false, error }, { status }));

  if (!z.string().uuid().safeParse(paperId).success) return no(400, "bad paper");
  if (!hasSupabaseConfig()) return no(503, "no auth");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return no(401, "signed out");
  if (!realtimeAllowed(user.email)) return upgrade ? no(403, "not enabled") : NextResponse.json({ enabled: false });
  const { data: paper } = await supabase.from("papers").select("id").eq("id", paperId).eq("user_id", user.id).maybeSingle();
  if (!paper) return no(404, "not found");
  const apiKey = process.env.GROK_API_KEY?.trim();
  if (!apiKey) return no(503, "voice unavailable");
  if (!upgrade) return NextResponse.json({ enabled: true });
  // The relay outlives this request: give it its own client on the student's
  // access token (RLS applies), not the request's cookie store.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return no(401, "signed out");
  const env = getPublicEnv();
  const db = createSupabase(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const effort = url.searchParams.get("effort") === "high" ? "high" : process.env.PAU_REALTIME_EFFORT === "high" && url.searchParams.get("effort") !== "none" ? "high" : "none";
  return upgradeWebSocket(
    async (client) => {
      await runRelay({
        client,
        supabase: db,
        userId: user.id,
        paperId,
        apiKey,
        resumeToken: url.searchParams.get("resume"),
        effort,
        vad: url.searchParams.get("vad") === "server" ? "server" : url.searchParams.get("vad") === "client" ? "client" : process.env.PAU_REALTIME_VAD === "server" ? "server" : "client",
      });
    },
    { maxPayload: 128 * 1024 },
  );
}
