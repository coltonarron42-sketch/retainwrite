import { AuthShell } from "@/components/auth/auth-shell";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dsError, dsLink } from "@/lib/ds/classes";

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
    <AuthShell
      minimal
      title="Set a new password"
      subtitle="Choose a new password, then log in with it."
    >
      {email ? (
        <ResetPasswordForm email={email} />
      ) : (
        <p className={dsError} role="alert">
          That reset link has expired or was opened somewhere else.{" "}
          <Link href="/forgot-password" className={dsLink}>
            Send&nbsp;a&nbsp;new&nbsp;link
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
