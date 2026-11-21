"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AssignmentIntake } from "@/components/stages/stage1/assignment-intake";
import { CoachingLoop } from "@/components/stages/loop/coaching-loop";
import { StageRail } from "@/components/stages/stage-rail";
import { assertStageUnlocked, type StageProgressRow } from "@/lib/stages/assert";
import { getDemoPaper, type DemoPaper } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  paperId: string;
  stage: number;
};

function loopStageAccess(progress: StageProgressRow[], stage: number) {
  if (stage === 3 || stage === 4) {
    const stage1 = progress.find((row) => row.stage === 1);
    const stage2 = progress.find((row) => row.stage === 2);
    if (stage1?.status === "complete" && stage2 && stage2.status !== "locked") {
      return { ok: true as const };
    }
  }
  return assertStageUnlocked(progress, stage);
}

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

  const gate = loopStageAccess(paper.stage_progress, stage);
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
          <AssignmentIntake paperId={paperId} demoMode />
        ) : (
          <CoachingLoop
            paperId={paperId}
            stage={stage}
            assignmentPrompt={paper.assignment_prompt}
          />
        )}
      </div>
    </div>
  );
}
