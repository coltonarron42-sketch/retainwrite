/** Pure helpers for the password-reset link. No server or browser imports. */

export type RecoveryHash =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; code: string }
  | { kind: "none" };

/** Read the implicit-flow fragment Supabase appends after /auth/v1/verify. */
export function parseRecoveryHash(hash: string): RecoveryHash {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { kind: "none" };
  const params = new URLSearchParams(raw);
  const errorCode = params.get("error_code") || params.get("error");
  if (errorCode) return { kind: "error", code: errorCode };
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken };
  return { kind: "none" };
}

export function resetErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "otp_expired":
    case "access_denied":
      return "That reset link has expired or was already used. Send yourself a new one below.";
    case "exchange_failed":
      return "That reset link was opened in a different browser than the one that asked for it. Send a new link below. New links work on any device.";
    case "missing_token":
      return "That reset link is incomplete. Send a new one below.";
    case "session_failed":
      return "We couldn't sign you in from that link. Send a new one below.";
    default:
      return "That reset link didn't work. Send a new one below.";
  }
}
