"use client";

import { useEffect, useRef, useState } from "react";
import { CheckoutOptions } from "@/components/billing/checkout-options";
import {
  createDemoPaper,
  getDemoProfile,
  saveDemoProfile,
  type DemoProfile,
} from "@/lib/demo/store";

export function NewPaperFlow({ stripeConfigured }: { stripeConfigured: boolean }) {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    try {
      const p = getDemoProfile();
      setProfile(p);

      if (!p.free_paper_used) {
        p.free_paper_used = true;
        saveDemoProfile(p);
        const paper = createDemoPaper({
          is_free_paper: true,
          audio_unlocked: false,
        });
        window.location.assign(`/app/papers/${paper.id}/stage/1`);
        return;
      }

      if (p.paper_credits > 0) {
        p.paper_credits -= 1;
        saveDemoProfile(p);
        const paper = createDemoPaper({
          funded_by: "pack3",
          audio_unlocked: true,
        });
        window.location.assign(`/app/papers/${paper.id}/stage/1`);
        return;
      }

      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start paper");
      setReady(true);
    }
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!ready || !profile) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-rw-ink/60">
        Starting your paper…
      </div>
    );
  }

  return (
    <div className="px-5 py-12 md:px-8">
      <CheckoutOptions
        demoMode
        stripeConfigured={stripeConfigured}
        cancelPath="/app/papers/new"
      />
    </div>
  );
}
