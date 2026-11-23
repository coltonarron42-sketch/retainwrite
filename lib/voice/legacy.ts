/**
 * The old cascade voice (TTS read-aloud, Voice on/off, voice-call dictation)
 * is fully stopped: Grok Voice (realtime) is the only voice path, and without
 * it the chat is text-only. The code stays behind this flag until it is
 * deleted. Set NEXT_PUBLIC_PAU_LEGACY_VOICE=on to bring it back.
 */
export function legacyVoiceOn(): boolean {
  return process.env.NEXT_PUBLIC_PAU_LEGACY_VOICE === "on";
}
