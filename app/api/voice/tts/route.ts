import { NextResponse } from "next/server";
import { legacyVoiceOn } from "@/lib/voice/legacy";
import { z } from "zod";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { demoTtsAllowed } from "@/lib/voice/demo-tts-limit";
import { isTtsCandidate, ttsFallbackVoice, TTS_MAX_CHARS, TTS_SPEED, ttsVoiceId } from "@/lib/voice/tts-config";

export const runtime = "nodejs";

// `voice` lets the team audition the candidate voices (allowlist only).
const bodySchema = z.object({ text: z.string().min(1).max(TTS_MAX_CHARS), voice: z.string().max(40).optional() });

/**
 * Pau's voice (PLAN.md 9): one sentence of her own words in, MP3 out,
 * via xAI text to speech (POST https://api.x.ai/v1/tts) with the same xAI key
 * the app already uses. Signed-in students (or the demo) only. 503 means "no
 * server voice": the browser falls back to Web Speech.
 * // SOP: coaching only — reads Pau's own words aloud, never the student's
 */
export async function POST(request: Request) {
  // The old voice is stopped (lib/voice/legacy.ts): no read-aloud audio.
  if (!legacyVoiceOn()) return NextResponse.json({ error: "tts_off" }, { status: 410 });
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "tts_unavailable" }, { status: 503 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const demo = await getDemoSession();
  if (demo) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip";
    if (!demoTtsAllowed(`${demo.createdAt}|${ip}`)) return NextResponse.json({ error: "demo_tts_limit" }, { status: 429 });
  } else {
    if (!hasSupabaseConfig()) return NextResponse.json({ error: "tts_unavailable" }, { status: 503 });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const call = (voice_id: string) =>
    fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text, voice_id, language: "en", speed: TTS_SPEED, text_normalization: true }),
      signal: AbortSignal.timeout(12_000),
    });
  try {
    const voice = isTtsCandidate(body.voice) ? body.voice : ttsVoiceId();
    let used = voice;
    let res = await call(voice);
    if (!res.ok && res.status >= 400 && res.status < 500 && ttsFallbackVoice(voice) !== voice) {
      used = ttsFallbackVoice(voice);
      res = await call(used);
    }
    if (!res.ok) {
      console.warn("[tts] upstream failed", { status: res.status });
      return NextResponse.json({ error: "tts_failed" }, { status: 502 });
    }
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        // The voice that actually spoke (QA 4:42 #7), so QA can confirm iris.
        "x-pau-voice": used,
        "Content-Type": res.headers.get("content-type")?.startsWith("audio/") ? res.headers.get("content-type")! : "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.warn("[tts] request error", { message: err instanceof Error ? err.message.slice(0, 120) : "error" });
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }
}
