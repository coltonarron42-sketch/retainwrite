import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { PasswordUpdatedListener } from "@/components/auth/password-updated-listener";
import { resetErrorMessage } from "@/lib/auth/reset";
import { dsError } from "@/lib/ds/classes";

export const metadata = { title: "Reset password" };

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const linkError = resetErrorMessage(params.error);
  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        <>
          Enter the email you signed up with. We&apos;ll send a link to set a
          new password.
        </>
      }
      notices={
        <>
          {linkError ? (
            <p className={`mt-4 ${dsError}`} role="alert">
              {linkError}
            </p>
          ) : null}
          <PasswordUpdatedListener showLoginLink />
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
