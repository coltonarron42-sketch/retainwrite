import Link from "next/link";
import { DemoLossBanner } from "@/components/app/demo-loss-banner";
import { requireUser } from "@/lib/auth/require-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireUser("/app");

  return (
    <div className="min-h-screen bg-rw-paper">
      {access.kind !== "user" ? <DemoLossBanner /> : null}
      <header className="border-b border-rw-ink/10 bg-white/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/app" className="font-display text-xl text-rw-ink">
            RetainWrite
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-rw-ink/70">
            <Link href="/app" className="hover:text-rw-ink">
              Papers
            </Link>
            <Link href="/app/billing" className="hover:text-rw-ink">
              Billing
            </Link>
            <Link href="/pricing" className="hover:text-rw-ink">
              Pricing
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
