import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { PasswordUpdatedAnnouncer } from "@/components/auth/password-updated-announcer";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Password updated" };
export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ email?: string }> };

/** Where a finished reset lands. The email-window session is already signed out. */
export default async function PasswordUpdatedPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const email = (params.email ?? "").trim().slice(0, 254);
  const loginHref = email ? `/login?email=${encodeURIComponent(email)}` : "/login";

  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28" role="status" data-testid="password-updated">
        <h1 className="font-display text-4xl text-rw-ink">Password updated.</h1>
        <p className="mt-3 text-sm text-rw-ink/70">
          Please return to your original browser and log in with your new password.
        </p>
        <Button asChild variant="secondary" className="mt-8 w-full">
          <Link href={loginHref}>Log in here instead</Link>
        </Button>
        <PasswordUpdatedAnnouncer email={email} />
      </div>
    </main>
  );
}
