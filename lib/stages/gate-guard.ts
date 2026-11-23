/**
 * Server-side stage gates (preserved gates). Opening a URL never moves a paper:
 * current_stage only advances one step at a time, through the progress route,
 * and leaving Stance (2 -> 3) needs every section confirmed or skipped in the
 * saved session. Autosave never moves current_stage.
 */
export type StageStatus = "locked" | "in_progress" | "complete";

export type StageMove =
  | { ok: true; currentStage: number; progress: { stage: number; status: StageStatus }[]; advanced: boolean }
  | { ok: false; reason: string };

type SessionLike = { sections?: { status?: string }[] } | null | undefined;

export function stanceComplete(session: SessionLike): boolean {
  const sections = session?.sections ?? [];
  return sections.length > 0 && sections.every((s) => s.status === "confirmed" || s.status === "skipped");
}

export function guardStageMove(input: {
  serverStage: number;
  requestedStage: number;
  progress: { stage: number; status: StageStatus }[];
  session: SessionLike;
}): StageMove {
  const { serverStage, requestedStage } = input;
  // Going back (or staying) never changes where the paper is.
  const target = Math.max(serverStage, requestedStage);
  if (target > serverStage + 1) return { ok: false, reason: "skip_ahead" };
  if (target === serverStage + 1) {
    if (serverStage < 2) return { ok: false, reason: "intake_only" };
    if (serverStage === 2 && !stanceComplete(input.session)) return { ok: false, reason: "stance_open" };
  }
  const progress = input.progress.map((row) => ({
    stage: row.stage,
    status: (row.stage > target ? "locked" : row.stage < target ? "complete" : row.status === "locked" ? "in_progress" : row.status) as StageStatus,
  }));
  return { ok: true, currentStage: target, progress, advanced: target > serverStage };
}

/** Autosave may move the resume pointer only within the paper's current stage. */
export function autosaveResumeAllowed(resumeStage: number, serverStage: number): boolean {
  return resumeStage === serverStage;
}

/** A /stage/N page past the paper's stage sends the student back to where they are. */
export function stageRedirect(requested: number, serverStage: number): number | null {
  return requested > serverStage ? serverStage : null;
}

export function screenForStage(stage: number): "outline" | "sources" | "draft" | "stance" {
  return stage >= 5 ? "draft" : stage === 4 ? "sources" : stage === 3 ? "outline" : "stance";
}
