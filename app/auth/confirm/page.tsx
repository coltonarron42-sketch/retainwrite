import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { confirmEmail } from "@/app/auth/confirm/actions";
import { isEmailOtpType } from "@/lib/auth/confirm";
import { safeInternalPath } from "@/lib/auth/site-url";

export const metadata = { title: "Confirm email" };

type Props = {
  searchParams?: Promise<{ token_hash?: string; type?: string; next?: string }>;
};

/**
 * Render a button. This GET does not exchange the token — a mail scanner
 * would spend it before the student clicks.
 */
export default async function ConfirmEmailPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const tokenHash = params.token_hash ?? "";
  const type = params.type ?? "";
  const isRecovery = type === "recovery";
  const next = isRecovery ? "/reset-password" : safeInternalPath(params.next);

  if (!tokenHash || !isEmailOtpType(type)) {
    redirect(
      isRecovery
        ? "/forgot-password?error=missing_token"
        : `/login?error=missing_token&next=${encodeURIComponent(next)}`,
    );
  }

  return (
    <AuthShell
      title={isRecovery ? "Reset your password" : "Confirm your email"}
      subtitle={
        isRecovery
          ? "Email apps sometimes open this link before you do. Click the button to choose a new password."
          : "Email apps sometimes open this link before you do. Click the button to finish confirming."
      }
    >
      <form action={confirmEmail}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="ds-btn-primary w-full">
          {isRecovery ? "Continue to reset password" : "Confirm my email"}
        </button>
      </form>
    </AuthShell>
  );
}
