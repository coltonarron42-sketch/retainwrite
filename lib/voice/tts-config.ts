/**
 * Server voice settings (no secrets here). PAU_TTS_VOICE picks the xAI voice.
 * Pau Pau sounds like a younger, down-to-earth comic (Colton, Nov 22 4:00 PM);
 * the candidates come from the xAI voice list (docs.x.ai, Voice Overview).
 */
export const TTS_MAX_CHARS = 600;
/** Candidates auditioned for her voice (xAI's own descriptions). */
export const TTS_CANDIDATES = {
  castor: "Charismatic, down-to-earth, and easygoing",
  sirius: "Quick-witted, clever, and playful",
  iris: "Friendly, upbeat, and naturally charming",
  ara: "Warm and friendly",
} as const;
export type TtsCandidate = keyof typeof TTS_CANDIDATES;
// iris: the most casual of the female-register voices (median F0 ~208 Hz in the
// audition; castor/sirius read ~120-136 Hz, which doesn't fit her). Samples:
// /workspace/voice-samples/pau-{castor,sirius,iris,ara}.mp3 (Nov 22 4:09 PM).
export const TTS_DEFAULT_VOICE: TtsCandidate = "iris";
/** A second voice if xAI rejects the first (e.g. a retired id). */
export function ttsFallbackVoice(voice: string): string {
  return voice === "ara" ? "eve" : "ara";
}
/** Slightly quicker than 1.0 reads relaxed, not sleepy; xAI allows 0.7-1.5. */
export const TTS_SPEED = 1.05;
export function ttsVoiceId(): string {
  const v = process.env.PAU_TTS_VOICE?.trim().toLowerCase();
  return v && /^[a-z0-9_-]{2,40}$/.test(v) ? v : TTS_DEFAULT_VOICE;
}
export function isTtsCandidate(v: unknown): v is TtsCandidate {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TTS_CANDIDATES, v);
}
