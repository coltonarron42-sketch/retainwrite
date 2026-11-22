/** Server voice settings (no secrets here). PAU_TTS_VOICE picks the xAI voice. */
export const TTS_MAX_CHARS = 600;
export function ttsVoiceId(): string {
  const v = process.env.PAU_TTS_VOICE?.trim().toLowerCase();
  return v && /^[a-z0-9_-]{2,40}$/.test(v) ? v : "ara";
}
