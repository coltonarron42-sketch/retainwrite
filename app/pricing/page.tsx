import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { PRICES } from "@/lib/config";
import { formatUsd } from "@/lib/utils";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-28 md:px-8">
        <h1 className="font-display text-4xl text-rw-ink md:text-5xl">
          Pay per paper. No subscription.
        </h1>
        <p className="mt-4 text-rw-ink/65">
          Your first paper is free. After that, buy one paper or a pack. Credits
          never expire. Unused credits refundable within 14 days; used credits
          and audio add-ons are not.
        </p>

        <dl className="mt-12 space-y-0">
          <div className="flex items-baseline justify-between border-t border-rw-ink/15 py-5">
            <dt>
              <p className="font-semibold text-rw-ink">First paper</p>
              <p className="text-sm text-rw-ink/60">The full coaching run. No audio. No card.</p>
            </dt>
            <dd className="text-lg font-semibold">Free</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-rw-ink/15 py-5">
            <dt>
              <p className="font-semibold text-rw-ink">Single paper</p>
              <p className="text-sm text-rw-ink/60">One full coaching run</p>
            </dt>
            <dd className="text-lg font-semibold">{formatUsd(PRICES.single)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-rw-ink/15 py-5">
            <dt>
              <p className="font-semibold text-rw-ink">3-paper pack</p>
              <p className="text-sm text-rw-ink/60">
                {formatUsd(500)} each · audio included
              </p>
            </dt>
            <dd className="text-lg font-semibold">{formatUsd(PRICES.pack3)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-b border-rw-ink/15 py-5">
            <dt>
              <p className="font-semibold text-rw-ink">Audio study beats</p>
              <p className="text-sm text-rw-ink/60">Optional add-on while you review sources</p>
            </dt>
            <dd className="text-lg font-semibold">{formatUsd(PRICES.audio)}</dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/signup">Start free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/app/papers/new">Go to checkout</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
