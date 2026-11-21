import { SITE_URL } from "@/lib/config";

function usableOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/localhost|127\.0\.0\.1/i.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/$/, "");
}

/** Public origin for auth emails. Env first, then Vercel, never localhost. */
export function getAuthSiteUrl(): string {
  return (
    usableOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    usableOrigin(process.env.VERCEL_URL) ||
    SITE_URL.replace(/\/$/, "")
  );
}

export function getEmailConfirmRedirectTo(nextPath = "/app"): string {
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app";
  // Point confirmation emails at our domain's token-hash handler (Safari/Gmail safe).
  return `${getAuthSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export function safeInternalPath(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export function authErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "missing_token":
      return "That confirmation link is incomplete. Request a new email and try again.";
    case "exchange_failed":
      return "We couldn't verify that link. It may have expired — request a new confirmation email.";
    case "otp_expired":
      return "That confirmation link expired. Sign up again or request a new confirmation email.";
    case "otp_disabled":
      return "Email confirmation is temporarily unavailable. Continue in demo mode or try again later.";
    case "access_denied":
      return "Confirmation was denied. Try a fresh link from your email.";
    case "auth":
      return "Email confirmation failed. Try the link again, or continue in demo mode.";
    default:
      return "Email confirmation failed. Try a fresh link, or continue in demo mode while we sort it out.";
  }
}
