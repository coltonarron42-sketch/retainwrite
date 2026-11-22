"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckoutOptions } from "@/components/billing/checkout-options";
import {
  createDemoPaper,
  getDemoProfile,
  saveDemoProfile,
  type DemoProfile,
} from "@/lib/demo/store";

export function NewPaperFlow({
  stripeConfigured,
  mode = "demo",
}: {
  stripeConfigured: boolean;
  mode?: "live" | "demo";
}) {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
    try {
      const p = getDemoProfile();
      setProfile(p);

      if (mode === "live") {
        const res = await fetch("/api/papers", { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          error?: string;
        };
        if (res.status === 402) {
          setReady(true);
          return;
        }
        if (!res.ok || !data.id) {
          setError(data.error ?? "Could not start the paper.");
          setReady(true);
          return;
        }
        window.location.assign(`/app/papers/${data.id}/stage/1`);
        return;
      }

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
    })();
  }, [mode, attempt]);

  if (error) {
    return (
      <div className="mx-auto max-w-[680px] px-6 py-12 font-ds-sans md:px-16">
        <p className="text-[16px] leading-[1.6] text-ds-error" role="alert">
          {error}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            className="ds-btn-primary"
            onClick={() => {
              started.current = false;
              setError(null);
              setReady(false);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
          <Link href="/app" className="ds-btn-secondary">
            Back to your papers
          </Link>
        </div>
      </div>
    );
  }

  if (!ready || !profile) {
    return (
      <div
        className="mx-auto max-w-[680px] px-6 py-12 font-ds-sans text-[16px] text-ds-muted md:px-16"
        role="status"
      >
        Starting your paper…
      </div>
    );
  }

  return (
    <div className="px-5 py-12 md:px-8">
      <CheckoutOptions
        demoMode={mode !== "live"}
        stripeConfigured={stripeConfigured}
        cancelPath="/app/papers/new"
      />
    </div>
  );
}
