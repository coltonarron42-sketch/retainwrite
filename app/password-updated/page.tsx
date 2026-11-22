import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordUpdatedAnnouncer } from "@/components/auth/password-updated-announcer";

export const metadata = { title: "Password updated" };
export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ email?: string }> };

/** Where a finished reset lands. The email-window session is already signed out. */
export default async function PasswordUpdatedPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const email = (params.email ?? "").trim().slice(0, 254);
  const loginHref = email
    ? `/login?email=${encodeURIComponent(email)}`
    : "/login";

  return (
    <AuthShell title="Password updated.">
      <div role="status" data-testid="password-updated">
        <p className="text-[16px] leading-[1.6] text-ds-ink">
          Please return to your original browser and log in with your new
          password.
        </p>
        <Link href={loginHref} className="ds-btn-primary mt-8 w-full">
          Log in here instead
        </Link>
        <PasswordUpdatedAnnouncer email={email} />
      </div>
    </AuthShell>
  );
}
