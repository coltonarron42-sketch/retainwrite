import { SiteHeader } from "@/components/marketing/site-header";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  let email = "";
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? "";
  }
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Set a new password</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          Choose a new password, then log in with it.
        </p>
        {email ? (
          <ResetPasswordForm email={email} />
        ) : (
          <p className="mt-8 text-sm text-red-700" role="alert">
            That reset link has expired or was opened somewhere else.{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              Send a new link
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
