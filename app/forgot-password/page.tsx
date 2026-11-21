import { SiteHeader } from "@/components/marketing/site-header";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Reset your password</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          Enter the email you signed up with. We&apos;ll send a link to set a new password.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
