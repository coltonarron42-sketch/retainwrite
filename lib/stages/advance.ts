// SOP: coaching only, never generate submission text

import type { StageProgressRow } from "@/lib/stages/assert";

export type SectionContinueTarget =
  | { kind: "section"; index: number }
  | { kind: "outline" };

/**
 * After a logic checkpoint that does not block, pick the next section
 * or the real Outline stage once every section is confirmed.
 */
export function sectionContinueTarget(
  sections: { status: string }[],
  activeIndex: number,
): SectionContinueTarget {
  for (let index = activeIndex + 1; index < sections.length; index += 1) {
    if (sections[index]?.status !== "confirmed") return { kind: "section", index };
  }
  for (let index = 0; index < activeIndex; index += 1) {
    if (sections[index]?.status !== "confirmed") return { kind: "section", index };
  }
  return { kind: "outline" };
}

export type StageAdvance = {
  progress: StageProgressRow[];
  nextStage: number;
  blocked: false;
};

function withStatus(
  progress: StageProgressRow[],
  stage: number,
  status: StageProgressRow["status"],
): StageProgressRow[] {
  return progress.map((row) => {
    if (row.stage !== stage) return row;
    if (status === "in_progress" && row.status === "complete") return row;
    return { ...row, status };
  });
}

/**
 * Outline stays open once Stance progress is complete.
 * A saved session can still list Body as open; that must not bounce the student back.
 */
export function productStageBounce(input: {
  stage: number;
  progress: { stage: number; status: string }[];
  sections: { status: string }[];
}): "stay" | "stance" {
  if (input.stage !== 3 && input.stage !== 4) return "stay";
  const previous = input.progress.find((row) => row.stage === input.stage - 1);
  if (previous?.status === "complete") return "stay";
  const settled =
    input.sections.length > 0 &&
    input.sections.every((section) => section.status === "confirmed" || section.status === "skipped");
  return settled ? "stay" : "stance";
}

/** Pass, Keep my angle, and Continue anyway all advance. Nothing blocks. */
export function progressAfterLogicContinue(
  progress: StageProgressRow[],
  destination: "section" | "outline",
): StageAdvance {
  if (destination === "section") {
    return {
      blocked: false,
      nextStage: 2,
      progress: withStatus(progress, 2, "in_progress"),
    };
  }
  let next = withStatus(progress, 2, "complete");
  next = withStatus(next, 3, "in_progress");
  return { blocked: false, nextStage: 3, progress: next };
}

/** Move Outline → Sources → Draft → Revise. Never blocks and never opens stage 7. */
export function advanceProductStage(
  progress: StageProgressRow[],
  fromStage: number,
): StageAdvance {
  if (fromStage >= 6) {
    return {
      blocked: false,
      nextStage: 6,
      progress: withStatus(progress, 6, "complete"),
    };
  }
  const nextStage = fromStage + 1;
  let next = withStatus(progress, fromStage, "complete");
  next = withStatus(next, nextStage, "in_progress");
  return { blocked: false, nextStage, progress: next };
}

/**
 * From a finished Stance logic check, visit every later product stage.
 * Used as the regression for the "Looks solid" dead end.
 */
export function advanceFromStage2ThroughEnd(progress: StageProgressRow[]): {
  stages: number[];
  progress: StageProgressRow[];
  blocked: false;
} {
  const stages = [2];
  let current = progressAfterLogicContinue(progress, "outline");
  stages.push(current.nextStage);
  while (current.nextStage < 6) {
    current = advanceProductStage(current.progress, current.nextStage);
    stages.push(current.nextStage);
  }
  return { stages, progress: current.progress, blocked: false };
}
