import { SiteHeader } from "@/components/marketing/site-header";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Set a new password</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          Choose a new password, then you&apos;ll go straight to your papers.
        </p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
