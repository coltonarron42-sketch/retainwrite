import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
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
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">
          {isRecovery ? "Reset your password" : "Confirm your email"}
        </h1>
        <p className="mt-3 text-sm text-rw-ink/65">
          {isRecovery
            ? "Email apps sometimes open this link before you do. Click the button to choose a new password."
            : "Email apps sometimes open this link before you do. Click the button to finish confirming."}
        </p>
        <form action={confirmEmail} className="mt-8">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit">
            {isRecovery ? "Continue to reset password" : "Confirm my email"}
          </Button>
        </form>
      </div>
    </main>
  );
}
