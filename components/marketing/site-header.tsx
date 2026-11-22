import Link from "next/link";
import { LogOutButton } from "@/components/auth/log-out-button";
import { Button } from "@/components/ui/button";
import { isSignedIn } from "@/lib/auth/current-user";

type Props = {
  /** Logo only, for pages the student should finish (password reset). */
  minimal?: boolean;
  /** PLAN.md 8 Editorial-Warm styling. Only the homepage uses it so far. */
  tone?: "default" | "editorial";
};

export async function SiteHeader({ minimal = false, tone = "default" }: Props = {}) {
  const signedIn = minimal ? false : await isSignedIn();
  const editorial = tone === "editorial";

  if (editorial) {
    return (
      <header className="border-b border-ds-border">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-4 md:px-16">
          <Link
            href="/"
            className="ds-focus rounded-[8px] font-display text-[20px] font-semibold leading-[1.2] text-ds-ink"
          >
            RetainWrite
          </Link>
          {minimal ? null : (
            <nav className="flex items-center gap-2 md:gap-4">
              <Link
                href="/ai-checker"
                className="ds-focus hidden rounded-[8px] px-2 py-2 text-[16px] text-ds-muted transition-colors duration-150 hover:text-ds-ink sm:inline"
              >
                AI checker
              </Link>
              <Link
                href="/pricing"
                className="ds-focus hidden rounded-[8px] px-2 py-2 text-[16px] text-ds-muted transition-colors duration-150 hover:text-ds-ink sm:inline"
              >
                Pricing
              </Link>
              {signedIn ? (
                <>
                  <Link href="/app" className="ds-btn-primary">
                    My papers
                  </Link>
                  <LogOutButton className="ds-focus rounded-[8px] px-2 py-2 text-[16px] font-semibold text-ds-ink transition-colors duration-150 hover:text-ds-muted" />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="ds-focus rounded-[8px] px-2 py-2 text-[16px] font-semibold text-ds-ink transition-colors duration-150 hover:text-ds-muted"
                  >
                    Log in
                  </Link>
                  <Link href="/signup" className="ds-btn-primary">
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
    );
  }

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
