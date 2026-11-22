import Link from "next/link";
import { LogOutButton } from "@/components/auth/log-out-button";
import { Button } from "@/components/ui/button";
import { isSignedIn } from "@/lib/auth/current-user";

/** `minimal`: logo only, for pages the student should finish (password reset). */
export async function SiteHeader({
  minimal = false,
}: { minimal?: boolean } = {}) {
  const signedIn = minimal ? false : await isSignedIn();
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-rw-ink md:text-2xl"
        >
          RetainWrite
        </Link>
        {minimal ? null : (
          <nav className="flex items-center gap-2 md:gap-3">
            <Link
              href="/ai-checker"
              className="hidden text-sm font-medium text-rw-ink/70 hover:text-rw-ink sm:inline"
            >
              AI checker
            </Link>
            <Link
              href="/pricing"
              className="hidden text-sm font-medium text-rw-ink/70 hover:text-rw-ink sm:inline"
            >
              Pricing
            </Link>
            {signedIn ? (
              <>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/app">My papers</Link>
                </Button>
                <LogOutButton className="text-sm font-medium text-rw-ink/70 hover:text-rw-ink" />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
