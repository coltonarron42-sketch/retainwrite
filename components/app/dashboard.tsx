"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getDemoProfile,
  listDemoPapers,
  type DemoPaper,
  type DemoProfile,
} from "@/lib/demo/store";
import { continueHref } from "@/lib/papers/resume";

type Props = {
  mode?: "live" | "demo";
  papers?: DemoPaper[];
  credits?: number;
  freePaperAvailable?: boolean;
};

export function Dashboard({
  mode = "demo",
  papers: accountPapers,
  credits = 0,
  freePaperAvailable = false,
}: Props) {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [papers, setPapers] = useState<DemoPaper[]>(accountPapers ?? []);

  useEffect(() => {
    if (mode === "live") return;
    setProfile(getDemoProfile());
    setPapers(listDemoPapers());
  }, [mode]);

  const creditCount = mode === "live" ? credits : (profile?.paper_credits ?? 0);
  const freeLeft =
    mode === "live" ? freePaperAvailable : Boolean(profile && !profile.free_paper_used);

  return (
    <main className="px-6 py-12 font-ds-sans md:px-16">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-[32px] font-semibold leading-[1.2] text-ds-ink">
              Your papers
            </h1>
            <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
              Credits: {creditCount}
              {freeLeft ? " · first paper still free" : ""}
            </p>
          </div>
          <Link href="/app/papers/new" className="ds-btn-primary w-full sm:w-auto">
            Start a new paper
          </Link>
        </div>

        <ul className="mt-8 divide-y divide-ds-border rounded-[12px] border border-ds-border bg-ds-surface shadow-ds-card">
          {papers.length === 0 && (
            <li className="p-8 text-[16px] leading-[1.6] text-ds-muted">
              No papers yet. Start your first free paper to begin Stage 1 intake.
            </li>
          )}
          {papers.map((paper) => (
            <li
              key={paper.id}
              className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between md:px-8"
            >
              <div className="min-w-0">
                <p className="font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">
                  {paper.title || "Untitled paper"}
                </p>
                <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted">
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
              <Link
                href={continueHref(paper)}
                className="ds-btn-secondary w-full shrink-0 sm:w-auto"
              >
                Continue
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
