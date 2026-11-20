"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getDemoProfile,
  listDemoPapers,
  type DemoPaper,
  type DemoProfile,
} from "@/lib/demo/store";

export function Dashboard() {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [papers, setPapers] = useState<DemoPaper[]>([]);

  useEffect(() => {
    setProfile(getDemoProfile());
    setPapers(listDemoPapers());
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-rw-ink">Your papers</h1>
          <p className="mt-2 text-sm text-rw-ink/60">
            Credits: {profile?.paper_credits ?? 0}
            {profile && !profile.free_paper_used
              ? " · first paper still free"
              : ""}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/papers/new">Start new paper</Link>
        </Button>
      </div>

      <ul className="mt-10 divide-y divide-rw-ink/10 border-y border-rw-ink/10">
        {papers.length === 0 && (
          <li className="py-8 text-rw-ink/55">
            No papers yet. Start your first free paper to begin Stage 1 intake.
          </li>
        )}
        {papers.map((paper) => (
          <li key={paper.id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-semibold text-rw-ink">
                {paper.title || "Untitled paper"}
              </p>
              <p className="text-sm text-rw-ink/55">
                Stage {paper.current_stage} ·{" "}
                {paper.is_free_paper
                  ? "Free"
                  : paper.funded_by === "pack3"
                    ? "Pack credit"
                    : paper.funded_by === "single"
                      ? "Single"
                      : "Unfunded"}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/papers/${paper.id}/stage/${paper.current_stage}`}>
                Continue
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
