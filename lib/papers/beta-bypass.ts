/**
 * Server-only credit skip for allowlisted beta accounts.
 * Default off. Not read from the query string, a cookie, or NEXT_PUBLIC_ env.
 */

export function betaCreditBypass(
  email: string | null | undefined,
  env?: { BETA_BYPASS_CREDITS?: string; BETA_BYPASS_EMAILS?: string },
): boolean {
  const source = env ?? (process.env as { BETA_BYPASS_CREDITS?: string; BETA_BYPASS_EMAILS?: string });
  if (source.BETA_BYPASS_CREDITS !== "true") return false;
  const allow = (source.BETA_BYPASS_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized || !allow.includes(normalized)) return false;
  return true;
}
