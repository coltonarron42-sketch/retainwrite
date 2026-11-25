"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CHECKOUT_PRODUCTS, PACK3_CREDITS, PRICES } from "@/lib/config";
import {
  addDemoPurchase,
  createDemoPaper,
  getDemoProfile,
  saveDemoProfile,
} from "@/lib/demo/store";
import { formatUsd } from "@/lib/utils";

type Kind = "single" | "pack3";

type Props = {
  demoMode?: boolean;
  stripeConfigured?: boolean;
  cancelPath?: string;
};

export function CheckoutOptions({
  demoMode = true,
  stripeConfigured = false,
  cancelPath = "/app/papers/new",
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loadingKind, setLoadingKind] = useState<Kind | null>(null);

  async function startCheckout(kind: Kind) {
    setError(null);
    setLoadingKind(kind);

    if (!demoMode && !stripeConfigured) {
      setError("Payments aren't available yet.");
      setLoadingKind(null);
      return;
    }

    if (demoMode || !stripeConfigured) {
      try {
        const profile = getDemoProfile();
        if (kind === "pack3") {
          profile.paper_credits += PACK3_CREDITS;
          addDemoPurchase({
            id: crypto.randomUUID(),
            kind: "pack3",
            amount_cents: PRICES.pack3,
            status: "paid",
            created_at: new Date().toISOString(),
          });
          profile.paper_credits -= 1;
          saveDemoProfile(profile);
          const paper = createDemoPaper({
            funded_by: "pack3",
            audio_unlocked: true,
          });
          window.location.assign(`/app/papers/${paper.id}/stage/1`);
          return;
        }

        addDemoPurchase({
          id: crypto.randomUUID(),
          kind: "single",
          amount_cents: PRICES.single,
          status: "paid",
          created_at: new Date().toISOString(),
        });
        saveDemoProfile(profile);
        const paper = createDemoPaper({
          funded_by: "single",
          audio_unlocked: false,
        });
        window.location.assign(`/app/papers/${paper.id}/stage/1`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Demo checkout failed");
        setLoadingKind(null);
      }
      return;
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, cancelPath }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoadingKind(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
        Checkout
      </p>
      <h1 className="mt-2 font-display text-4xl text-rw-ink">
        Unlock your next paper
      </h1>
      <p className="mt-3 text-rw-ink/65">
        Pay per paper. No subscription.{" "}
        {demoMode || !stripeConfigured
          ? "Demo mode simulates payment locally until Stripe keys are set."
          : "You'll finish on a secure Stripe Checkout page."}
      </p>

      <div className="mt-10 space-y-4">
        <button
          type="button"
          onClick={() => startCheckout("single")}
          disabled={loadingKind !== null}
          className="flex w-full items-start justify-between gap-4 border-t border-rw-ink/15 py-5 text-left transition hover:bg-rw-ink/[0.03]"
        >
          <span>
            <span className="block text-lg font-semibold text-rw-ink">
              {CHECKOUT_PRODUCTS.single.name}
            </span>
            <span className="mt-1 block text-sm text-rw-ink/60">
              One paper, start to finish. Audio optional later.
            </span>
          </span>
          <span className="shrink-0 text-lg font-semibold text-rw-ink">
            {formatUsd(PRICES.single)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => startCheckout("pack3")}
          disabled={loadingKind !== null}
          className="flex w-full items-start justify-between gap-4 border-t border-b border-rw-ink/15 py-5 text-left transition hover:bg-rw-ink/[0.03]"
        >
          <span>
            <span className="block text-lg font-semibold text-rw-ink">
              {CHECKOUT_PRODUCTS.pack3.name}
            </span>
            <span className="mt-1 block text-sm text-rw-ink/60">
              {formatUsd(500)} per paper, audio included. Credits never expire.
            </span>
          </span>
          <span className="shrink-0 text-lg font-semibold text-rw-ink">
            {formatUsd(PRICES.pack3)}
          </span>
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={() => {
            window.location.assign("/app");
          }}
          disabled={loadingKind !== null}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
