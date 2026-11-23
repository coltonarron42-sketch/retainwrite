/**
 * Soft-gate copy (Colton, Nov 23 3:18 PM): every later stage (2-6) opens with Pau
 * Pau's short overview of what happens there, then what we still need first.
 * Scripted, not model-generated: the same words on screen and on a voice call.
 * Sources: PLAN.md stage purposes. One quip at most, student-safe.
 */
import { STAGE_LABELS } from "@/lib/config";

export const SOFT_GATE_DEFAULT = "We need a bit more info from an earlier stage before we can start building here.";
export const SOFT_GATE_STAGE3 =
  "In this stage we really start putting the whole project together. Get your Stage 2 info in and we can help make something incredible.";

export const GATE_OVERVIEW: Record<number, string> = {
  2: "Stance is where we figure out what you actually think, one section at a time, and lock in your best ideas in your own words. Think of it as an interview where you're the expert.",
  3: "Outline is where your locked-in ideas turn into the skeleton of your paper, section by section, so you can see how it all fits.",
  4: "Sources is where we find and check real sources for each section, so every point you make has backup. Fewer mystery websites, more receipts.",
  5: "Drafting is where you write each paragraph yourself, in your own voice, with me coaching from the sidelines.",
  6: "Revise is where you tighten your draft, check it against the assignment, and get it ready to hand in.",
};

const label = (stage: number) => `Stage ${stage}: ${STAGE_LABELS[stage - 1] ?? ""}`;

/** What we still need first. Stage 3 uses Colton's line when Stage 2 is the one open. */
export function gateNeed(stage: number, paperStage: number): string {
  if (stage === 3 && paperStage === 2) return SOFT_GATE_STAGE3;
  if (paperStage >= 1 && paperStage < stage) {
    return `We need a bit more info from an earlier stage (${label(paperStage)}) before we can start building here.`;
  }
  return SOFT_GATE_DEFAULT;
}

/** On-screen turn: overview, then the need line. */
export function gateParas(stage: number, paperStage: number): string[] {
  return [GATE_OVERVIEW[stage] ?? "", gateNeed(stage, paperStage)].filter(Boolean);
}

/** Spoken version (no parentheses read aloud). */
export function gateSpoken(stage: number, paperStage: number): string {
  const need = gateNeed(stage, paperStage).replace(
    /an earlier stage \(Stage (\d): ([A-Za-z]+)\)/,
    "Stage $1, $2,",
  );
  return [GATE_OVERVIEW[stage] ?? "", need].filter(Boolean).join(" ");
}
