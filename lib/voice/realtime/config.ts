/**
 * Grok Voice realtime proof of concept (Stage 2 only, flag-gated).
 * See /docs or PLAN.md 9. The browser never sees the xAI key: it talks to our
 * relay (app/api/voice/realtime), which holds the key and the ONLY session config.
 */
export const XAI_REALTIME_MODEL = "grok-voice-latest";
export const XAI_REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${XAI_REALTIME_MODEL}`;
export const REALTIME_VOICE = "iris";
export const REALTIME_RATE = 24_000;
/** Vercel Pro functions stop at 800 s: rotate the socket (with resumption) before that. */
export const ROTATE_IDLE_AFTER_MS = 690_000;
export const ROTATE_FORCE_AFTER_MS = 770_000;
/** Hard cap per connected socket chain, per day is out of scope for the PoC. */
export const MAX_TEXT_CHARS = 2_000;

/** Comma/space/semicolon separated emails, matched case-insensitively. */
export function parseAllowlist(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.includes("@")),
  );
}

export function realtimeAllowed(email: string | null | undefined, raw = process.env.PAU_REALTIME_ALLOWLIST): boolean {
  if (!email) return false;
  return parseAllowlist(raw).has(email.trim().toLowerCase());
}
