import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-rw-ink md:text-2xl"
        >
          RetainWrite
        </Link>
        <nav className="flex items-center gap-2 md:gap-3">
          <Link
            href="/pricing"
            className="hidden text-sm font-medium text-rw-ink/70 hover:text-rw-ink sm:inline"
          >
            Pricing
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/signup">Start free</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
