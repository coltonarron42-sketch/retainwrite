"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IntakeQuestionnaire } from "@/components/stages/intake-questionnaire";
import { StageRail } from "@/components/stages/stage-rail";
import { assertStageUnlocked } from "@/lib/stages/assert";
import { getDemoPaper, type DemoPaper } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  paperId: string;
  stage: number;
};

export function StageShell({ paperId, stage }: Props) {
  const router = useRouter();
  const [paper, setPaper] = useState<DemoPaper | null | undefined>(undefined);

  useEffect(() => {
    setPaper(getDemoPaper(paperId) ?? null);
  }, [paperId]);

  const statuses = useMemo(() => {
    const map: Record<number, "locked" | "in_progress" | "complete"> = {};
    paper?.stage_progress.forEach((s) => {
      map[s.stage] = s.status;
    });
    return map;
  }, [paper]);

  if (paper === undefined) {
    return <div className="p-8 text-rw-ink/50">Loading…</div>;
  }

  if (!paper) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <h1 className="font-display text-3xl">Paper not found</h1>
        <Button asChild className="mt-6" variant="secondary">
          <Link href="/app">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const gate = assertStageUnlocked(paper.stage_progress, stage);
  if (!gate.ok) {
    return (
      <div className="flex min-h-[70vh] flex-col md:flex-row">
        <StageRail
          paperId={paperId}
          current={stage}
          statuses={statuses}
        />
        <div className="flex-1 px-5 py-10 md:px-10">
          <h1 className="font-display text-3xl text-rw-ink">Stage locked</h1>
          <p className="mt-3 text-rw-ink/65">{gate.reason}</p>
          <Button
            className="mt-6"
            variant="secondary"
            onClick={() =>
              router.push(`/app/papers/${paperId}/stage/${paper.current_stage}`)
            }
          >
            Go to current stage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col md:flex-row">
      <StageRail paperId={paperId} current={stage} statuses={statuses} />
      <div className="flex-1 px-5 py-10 md:px-10">
        {stage === 1 ? (
          <IntakeQuestionnaire paperId={paperId} demoMode />
        ) : (
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
              Stage {stage}
            </p>
            <h1 className="mt-2 font-display text-3xl text-rw-ink">
              Coming next
            </h1>
            <p className="mt-3 text-rw-ink/65">
              Stage {stage} UI ships after intake. Finish Stage 1 to unlock the
              rest of the coaching path.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
