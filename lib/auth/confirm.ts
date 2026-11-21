const OTP_TYPES = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export function isEmailOtpType(value: string): boolean {
  return OTP_TYPES.has(value);
}

/**
 * GET must not decide this. A prefetch can open the link before the student does.
 * A used token still enters the app when this browser already has a session
 * or the account is already confirmed.
 */
export function confirmOutcome(input: {
  verifyError: string | null;
  hasSession: boolean;
  confirmed: boolean;
}): "next" | "app" | "otp_expired" | "exchange_failed" {
  if (!input.verifyError) return "next";
  if (input.hasSession || input.confirmed) return "app";
  if (input.verifyError.toLowerCase().includes("expired")) return "otp_expired";
  return "exchange_failed";
}
