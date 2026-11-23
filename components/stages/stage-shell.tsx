"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentRequirements } from "@/lib/assignment/schema";
import { AssignmentIntake } from "@/components/stages/stage1/assignment-intake";
import { CoachingLoop } from "@/components/stages/loop/coaching-loop";
import { StageProgress } from "@/components/stages/stage-progress";
import type { StageProgressRow } from "@/lib/stages/assert";
import { softGateMessage, stageView } from "@/lib/stages/gate-guard";
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

/** One line per stage for the soft-gate look. */
const STAGE_PREVIEWS = [
  "Intake: share the assignment and a little about how you write.",
  "Stance: find what you think, section by section, and lock it in.",
  "Outline: your locked-in ideas become the skeleton of the whole paper.",
  "Sources: find and check the sources that back up each section.",
  "Drafting: write each paragraph yourself, with Pau Pau coaching.",
  "Revise: tighten your draft and get it ready to hand in.",
];

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
      <div className="flex min-h-[70vh] flex-1 flex-col" data-stage-view="ahead">
        <div className={stage <= 3 ? "mx-auto w-full max-w-[728px] px-6 pt-2" : "px-6 pt-2 md:px-16"}>
          <StageProgress paperId={paperId} current={stage} statuses={statuses} />
        </div>
        <div className="mx-auto w-full max-w-[728px] flex-1 px-6 pb-12 pt-4 font-ds-sans text-ds-ink">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ds-muted">
            Stage {stage} · {STAGE_LABELS[stage - 1]}
          </p>
          <p className="mt-3 text-[17px] leading-[1.6]" data-soft-gate>
            {softGateMessage(stage)}
          </p>
          <Button asChild className="mt-6">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
          {/* A look at the stage: nothing here is live until the earlier stage is done. */}
          <div inert className="mt-8 rounded-[12px] border border-ds-border p-4 opacity-60" aria-label="Preview, not active yet">
            <p className="text-[15px] leading-[1.6] text-ds-muted">{STAGE_PREVIEWS[stage - 1]}</p>
            <textarea disabled rows={2} className="mt-3 w-full resize-none rounded-[8px] border border-ds-border bg-transparent p-2 text-[15px]" placeholder="Pau Pau opens here once the earlier stage is done." />
          </div>
        </div>
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
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </div>
      ) : null}
      {/* Review is read-only: no inputs, taps or Pau Pau actions on a finished stage. */}
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
            confirmedPrompt={initialRequirements?.promptQuestion.value ?? null}
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
