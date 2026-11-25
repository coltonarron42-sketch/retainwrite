"use client";

import { questionOf } from "@/lib/copy/sentences";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentRequirements } from "@/lib/assignment/schema";
import { AssignmentIntake } from "@/components/stages/stage1/assignment-intake";
import { CoachingLoop } from "@/components/stages/loop/coaching-loop";
import { StageProgress } from "@/components/stages/stage-progress";
import type { StageProgressRow } from "@/lib/stages/assert";
import { stageView } from "@/lib/stages/gate-guard";
import { SoftGateView } from "@/components/stages/soft-gate-view";
import { STAGE_LABELS } from "@/lib/config";
import { getDemoPaper, upsertDemoPaper, type DemoPaper } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  paperId: string;
  stage: number;
  demoMode?: boolean;
  initialPaper?: DemoPaper | null;
  initialRequirements?: AssignmentRequirements | null;
  initialRawText?: string;
  storyAnswer?: string | null;
};

export function StageShell({
  paperId,
  stage,
  demoMode = false,
  initialPaper = null,
  initialRequirements = null,
  initialRawText = "",
  storyAnswer = null,
}: Props) {
  const router = useRouter();
  const [paper, setPaper] = useState<DemoPaper | null | undefined>(undefined);

  useEffect(() => {
    if (initialPaper) {
      setPaper(initialPaper);
      return;
    }
    setPaper(demoMode ? (getDemoPaper(paperId) ?? null) : null);
  }, [paperId, demoMode, initialPaper]);

  const statuses = useMemo(() => {
    const map: Record<number, "locked" | "in_progress" | "complete"> = {};
    paper?.stage_progress.forEach((s) => {
      map[s.stage] = s.status;
    });
    return map;
  }, [paper]);

  if (paper === undefined) {
    return <div className="p-8 font-ds-sans text-[16px] text-ds-muted">Loading…</div>;
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

  // Past stages: read-only review. Later stages: soft gate (message + a look,
  // nothing live, nothing written). The paper's own stage: live. (Colton, Nov 23)
  const view = stageView(stage, paper.current_stage);
  const here = paper.current_stage;
  const backHref = `/app/papers/${paperId}/stage/${here}`;
  const backLabel = `Back to Stage ${here}: ${STAGE_LABELS[here - 1] ?? ""}`;
  if (view === "ahead") {
    return (
      <div className="flex min-h-[70vh] flex-1 flex-col">
        <div className={stage <= 3 ? "mx-auto w-full max-w-[728px] px-6 pt-2" : "px-6 pt-2 md:px-16"}>
          <StageProgress paperId={paperId} current={stage} statuses={statuses} />
        </div>
        <SoftGateView paperId={paperId} stage={stage} paperStage={here} />
      </div>
    );
  }
  const review = view === "review";

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col">
      {/* PLAN.md 9: a slim progress row, not a stage sidebar. */}
      <div className={stage <= 3 ? "mx-auto w-full max-w-[728px] px-6 pt-2" : "px-6 pt-2 md:px-16"}>
        <StageProgress paperId={paperId} current={stage} statuses={statuses} />
      </div>
      {review ? (
        <div className={stage <= 3 ? "mx-auto w-full max-w-[728px] px-6" : "px-6 md:px-16"} data-stage-view="review">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-ds-page px-4 py-3 font-ds-sans text-[15px] text-ds-ink">
            <span>Stage {stage} is done. You&apos;re looking back at your saved work (read-only).</span>
            <Button asChild size="sm">
              <a href={backHref} data-stage-back>{backLabel}</a>
            </Button>
          </div>
        </div>
      ) : null}
      {/* Review is read-only: no inputs, taps or Pau actions on a finished stage. */}
      {/* A disabled fieldset turns off every input and button but keeps scrolling. */}
      <fieldset
        disabled={review}
        className="m-0 min-w-0 flex-1 border-0 px-6 pb-12 pt-2 md:px-16"
        data-review={review ? "true" : undefined}
        onClickCapture={review ? (e) => { if (!(e.target as HTMLElement).closest("a")) { e.preventDefault(); e.stopPropagation(); } } : undefined}
        onKeyDownCapture={review ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); } } : undefined}
      >
        {stage === 1 ? (
          // Stage 1 is on the PLAN.md 8 Editorial-Warm system; later stages are not yet.
          <div className="font-ds-sans text-ds-ink">
            <AssignmentIntake
              paperId={paperId}
              demoMode={demoMode}
              accountPaper={demoMode ? null : paper}
              initialRequirements={initialRequirements}
              initialRawText={initialRawText}
            />
          </div>
        ) : (
          <CoachingLoop
            paperId={paperId}
            stage={stage}
            paperStage={paper.current_stage}
            assignmentPrompt={paper.assignment_prompt}
            confirmedTopic={initialRequirements?.topic.value ?? null}
            confirmedPrompt={questionOf(initialRequirements?.promptQuestion.value) || null}
            storyAnswer={storyAnswer}
            savedBeat={paper.stage_progress.find((row) => row.stage === 5)?.data ?? null}
            persist={!demoMode}
            stageProgress={paper.stage_progress.map((row) => ({
              stage: row.stage,
              status: row.status,
            }))}
            onStageProgress={async (progress: StageProgressRow[], currentStage: number) => {
              let payload: { stage: number; status: StageProgressRow["status"] }[] = [];
              setPaper((prev) => {
                if (!prev) return prev;
                const next: DemoPaper = {
                  ...prev,
                  current_stage: currentStage,
                  stage_progress: prev.stage_progress.map((row) => {
                    const updated = progress.find((item) => item.stage === row.stage);
                    return updated ? { ...row, status: updated.status } : row;
                  }),
                };
                upsertDemoPaper(next);
                payload = next.stage_progress.map((row) => ({
                  stage: row.stage,
                  status: row.status,
                }));
                return next;
              });
              if (demoMode) return true;
              const res = await fetch(`/api/papers/${paperId}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentStage, progress: payload }),
              });
              return res.ok;
            }}
          />
        )}
      </fieldset>
    </div>
  );
}
