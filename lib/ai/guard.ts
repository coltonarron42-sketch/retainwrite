/**
 * Coaching-only guard for model outputs.
 * // SOP: coaching only, never generate submission text
 */

const REWRITE_PATTERNS = [
  /\bhere(?:'s| is) (?:a |your )?(?:rewritten|revised|improved) (?:version|paragraph|thesis|essay)\b/i,
  /\b(?:i(?:'ve| have) )?(?:rewritten|paraphrased|humanized) (?:your|the) (?:text|draft|paragraph)\b/i,
  /\buse this (?:paragraph|thesis|sentence) (?:instead|in your paper)\b/i,
];

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: string };

export function assertCoachingOnly(text: string): GuardResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true };

  for (const pattern of REWRITE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: "Model output attempted to rewrite submission prose.",
      };
    }
  }

  return { ok: true };
}

export function rejectIfRewritesStudentWork<T extends { text?: string; content?: string }>(
  output: T,
): GuardResult {
  const blob = `${output.text ?? ""} ${output.content ?? ""}`;
  return assertCoachingOnly(blob);
}

export { guardTeachCard } from "@/lib/coaching/teach";
export { assertGentleInvitation } from "@/lib/coaching/memoryTriggers";
