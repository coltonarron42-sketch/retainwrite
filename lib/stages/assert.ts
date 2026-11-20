export type StageStatus = "locked" | "in_progress" | "complete";

export type StageProgressRow = {
  stage: number;
  status: StageStatus;
};

/**
 * Server-side gate: stage N is unlocked if N === 1 or stage N-1 is complete.
 */
export function assertStageUnlocked(
  progress: StageProgressRow[],
  stage: number,
): { ok: true } | { ok: false; reason: string } {
  if (stage < 1 || stage > 6) {
    return { ok: false, reason: "Stage must be between 1 and 6." };
  }
  if (stage === 1) return { ok: true };
  const prev = progress.find((p) => p.stage === stage - 1);
  if (!prev || prev.status !== "complete") {
    return {
      ok: false,
      reason: `Stage ${stage} is locked until stage ${stage - 1} is complete.`,
    };
  }
  return { ok: true };
}

export function initialStageProgress(): StageProgressRow[] {
  return Array.from({ length: 6 }, (_, i) => ({
    stage: i + 1,
    status: i === 0 ? ("in_progress" as const) : ("locked" as const),
  }));
}
