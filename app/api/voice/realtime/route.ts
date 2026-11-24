import { liveStage } from "@/lib/voice/realtime/flow-state";
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
 * Grok Voice realtime relay (Stages 1-2, flag-gated).
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
  const { data: paper } = await supabase.from("papers").select("id, current_stage").eq("id", paperId).eq("user_id", user.id).maybeSingle();
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
        vadTuning: vadTuning(url),
        gate: gateFor(url, (paper.current_stage as number | null) ?? 1),
        stage: liveStage(url.searchParams.get("stage"), (paper.current_stage as number | null) ?? 1),
        vad: url.searchParams.get("vad") === "server" ? "server" : url.searchParams.get("vad") === "client" ? "client" : process.env.PAU_REALTIME_VAD === "client" ? "client" : "server",
      });
    },
    { maxPayload: 128 * 1024 },
  );
}

/** A soft-gated stage (later than the paper's): she says the scripted gate line once, nothing else. */
function gateFor(url: URL, paperStage: number): { stage: number; paperStage: number } | undefined {
  const stage = Number(url.searchParams.get("gate"));
  return Number.isInteger(stage) && stage >= 2 && stage <= 6 && stage > paperStage ? { stage, paperStage } : undefined;
}

/** Test-only server VAD tuning from the query (?sil=300&thr=0.6); omitted when unset. */
function vadTuning(url: URL): { silence_duration_ms?: number; threshold?: number } | undefined {
  const sil = Number(url.searchParams.get("sil"));
  const thr = Number(url.searchParams.get("thr"));
  const out: { silence_duration_ms?: number; threshold?: number } = {};
  if (Number.isInteger(sil) && sil >= 100 && sil <= 2000) out.silence_duration_ms = sil;
  if (Number.isFinite(thr) && thr >= 0.1 && thr <= 0.9) out.threshold = thr;
  return Object.keys(out).length ? out : undefined;
}
