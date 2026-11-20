"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getDemoProfile,
  listDemoPurchases,
  type DemoProfile,
  type DemoPurchase,
} from "@/lib/demo/store";
import { formatUsd } from "@/lib/utils";

export function BillingPage() {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [purchases, setPurchases] = useState<DemoPurchase[]>([]);

  useEffect(() => {
    setProfile(getDemoProfile());
    setPurchases(listDemoPurchases());
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 md:px-8">
      <h1 className="font-display text-4xl text-rw-ink">Billing</h1>
      <p className="mt-2 text-rw-ink/65">
        Paper credits remaining:{" "}
        <span className="font-semibold text-rw-ink">
          {profile?.paper_credits ?? 0}
        </span>
      </p>
      <Button asChild className="mt-6" variant="secondary">
        <Link href="/app/papers/new">Buy a paper or pack</Link>
      </Button>

      <h2 className="mt-12 text-lg font-semibold text-rw-ink">Purchase history</h2>
      <ul className="mt-4 divide-y divide-rw-ink/10 border-y border-rw-ink/10">
        {purchases.length === 0 && (
          <li className="py-6 text-sm text-rw-ink/55">No purchases yet.</li>
        )}
        {purchases.map((p) => (
          <li key={p.id} className="flex justify-between py-3 text-sm">
            <span>
              {p.kind} · {p.status}
            </span>
            <span>{formatUsd(p.amount_cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
