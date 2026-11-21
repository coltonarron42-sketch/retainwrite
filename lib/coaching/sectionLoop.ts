// SOP: coaching only, never generate submission text

import type { LoopStep, TeachStatus } from "@/lib/coaching/teach";
import { LOOP_STEP_ORDER, teachIsDone } from "@/lib/coaching/teach";

export type SectionLockState = {
  key: string;
  title: string;
  status: "open" | "skipped" | "confirmed" | "reopened";
  teachStatus: TeachStatus | null;
  loopStep: LoopStep;
  searchStatus?: "required" | "optional" | "not_needed";
};

const STEP_INDEX = Object.fromEntries(LOOP_STEP_ORDER.map((step, index) => [step, index])) as Record<
  LoopStep,
  number
>;

export function earlierSectionsSettled(
  sections: SectionLockState[],
  sectionKey: string,
): { ok: true } | { ok: false; blockingTitle: string } {
  const index = sections.findIndex((section) => section.key === sectionKey);
  if (index < 0) return { ok: false, blockingTitle: "this section" };
  for (const earlier of sections.slice(0, index)) {
    if (earlier.status !== "confirmed" && earlier.status !== "skipped") {
      return { ok: false, blockingTitle: earlier.title };
    }
  }
  return { ok: true };
}

export function assertSectionStepUnlocked(
  sections: SectionLockState[],
  sectionKey: string,
  step: LoopStep,
): { ok: true } | { ok: false; reason: string } {
  const settled = earlierSectionsSettled(sections, sectionKey);
  if (!settled.ok) {
    return { ok: false, reason: `Finish or skip ${settled.blockingTitle} first.` };
  }
  const section = sections.find((item) => item.key === sectionKey);
  if (!section) return { ok: false, reason: "Unknown section." };
  if (step === "teach") return { ok: true };
  if (!teachIsDone(section.teachStatus)) {
    return { ok: false, reason: "Teach this section first, or skip the lesson." };
  }
  if (section.searchStatus === "not_needed" && step === "search") {
    return { ok: true };
  }
  const current = STEP_INDEX[section.loopStep];
  const target = STEP_INDEX[step];
  if (target > current + 1 && !(section.searchStatus === "not_needed" && step === "summarize")) {
    return { ok: false, reason: "That step is still ahead." };
  }
  return { ok: true };
}

export function skipSection(section: SectionLockState): SectionLockState {
  return { ...section, status: "skipped" };
}

export function nextSectionUnlocks(sections: SectionLockState[], skippedKey: string): boolean {
  const index = sections.findIndex((section) => section.key === skippedKey);
  const next = sections[index + 1];
  if (!next) return true;
  const updated = sections.map((section) =>
    section.key === skippedKey ? skipSection(section) : section,
  );
  return earlierSectionsSettled(updated, next.key).ok;
}

export function stage5Locked(sections: { status: string }[]): boolean {
  return sections.some((section) => section.status === "skipped" || section.status === "open" || section.status === "reopened");
}

export function previewWritesNothing<T>(state: T): T {
  return state;
}

export function counterargumentRequired(input: {
  rubricRequiresCounterargument?: boolean;
  assignmentText?: string;
  paperType?: string | null;
}): boolean {
  if (input.rubricRequiresCounterargument) return true;
  if (/\bcounter-?argument\b|\brebuttal\b/i.test(input.assignmentText ?? "")) return true;
  return false;
}

export function withCounterargumentSection<T extends { kind: string; title: string }>(
  sections: T[],
  required: boolean,
  make: () => T,
): T[] {
  const without = sections.filter((section) => section.kind !== "counter");
  if (!required) return without;
  if (sections.some((section) => section.kind === "counter")) return sections;
  const conclusion = without.findIndex((section) => section.kind === "conclusion");
  const next = [...without];
  const section = make();
  if (conclusion >= 0) next.splice(conclusion, 0, section);
  else next.push(section);
  return next;
}
