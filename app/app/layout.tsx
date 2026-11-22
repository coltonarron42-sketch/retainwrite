import Link from "next/link";
import { AppNavLink } from "@/components/app/app-nav-link";
import { DemoLossBanner } from "@/components/app/demo-loss-banner";
import { LogOutButton } from "@/components/auth/log-out-button";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Signed-in shell, PLAN.md section 8 (Editorial-Warm). Only the frame (page
 * background, banner, header) is restyled here; Stage content keeps its own styles.
 */
const sessionButton =
  "ds-focus rounded-[8px] px-2 py-2 text-[16px] font-semibold text-ds-ink transition-colors duration-150 hover:text-ds-muted";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireUser("/app");

  return (
    <div className="min-h-screen bg-ds-page">
      {access.kind !== "user" ? <DemoLossBanner /> : null}
      <header className="border-b border-ds-border px-6 py-4 font-ds-sans md:px-16">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            href="/"
            className="ds-focus rounded-[8px] font-display text-[20px] font-semibold leading-[1.2] text-ds-ink"
          >
            RetainWrite
          </Link>
          <nav aria-label="Account" className="-mr-2 flex flex-wrap items-center gap-x-1 md:gap-x-3">
            <AppNavLink href="/app" exact>
              My papers
            </AppNavLink>
            <AppNavLink href="/app/billing">Billing</AppNavLink>
            <AppNavLink href="/pricing">Pricing</AppNavLink>
            {access.kind === "user" ? (
              <LogOutButton className={sessionButton} />
            ) : access.kind === "demo" ? (
              <LogOutButton className={sessionButton} label="Exit demo" />
            ) : null}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
