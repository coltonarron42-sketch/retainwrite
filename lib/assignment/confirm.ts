import type { AssignmentRequirements, Field } from "@/lib/assignment/schema";
import { markNotSpecified } from "@/lib/assignment/confirm-helpers";

export type ConfirmGateResult =
  | { ok: true; requirements: AssignmentRequirements }
  | { ok: false; reasons: string[] };

export {
  markFieldConfirmed,
  markNotSpecified,
} from "@/lib/assignment/confirm-helpers";

/**
 * Checklist confirm (Nov 20, 2026): one tap confirms everything.
 * Missing fields become Not specified. citationStyle "other" still needs other text.
 * Pasted text is never required.
 */
export function assertAssignmentConfirmGate(
  requirements: AssignmentRequirements,
): ConfirmGateResult {
  const reasons: string[] = [];

  const topic = requirements.topic.value?.trim() ?? "";
  const prompt = requirements.promptQuestion.value?.trim() ?? "";
  if (!topic && !prompt) {
    reasons.push("Paste or type the topic or the prompt question before continuing.");
  }

  if (
    requirements.citationStyle.value === "other" &&
    !requirements.citationStyleOther?.trim()
  ) {
    reasons.push("Describe the other citation style");
  }

  if (reasons.length) return { ok: false, reasons };

  const next = confirmAllFields(requirements);
  return { ok: true, requirements: next };
}

/** Mark every field confirmed; missing → Not specified. */
export function confirmAllFields(
  requirements: AssignmentRequirements,
): AssignmentRequirements {
  const keys = [
    "course",
    "paperType",
    "topic",
    "promptQuestion",
    "length",
    "citationStyle",
    "formattingRules",
    "requiredSources",
    "providedReadings",
    "providedSources",
    "structuralRequirements",
    "dueDate",
    "rubricCriteria",
    "otherInstructions",
    "aiPolicy",
    "language",
  ] as const;

  const next: AssignmentRequirements = { ...requirements };
  for (const key of keys) {
    const field = next[key];
    if (!field || typeof field !== "object" || !("confirmed" in field)) continue;
    const f = field as Field<unknown>;
    if (f.confirmed) continue;
    const empty =
      f.value == null ||
      (typeof f.value === "string" && !f.value.trim()) ||
      (Array.isArray(f.value) && f.value.length === 0);
    if (empty || f.source === "missing") {
      // @ts-expect-error field assign
      next[key] = markNotSpecified(f);
    } else {
      // @ts-expect-error field assign
      next[key] = { ...f, confirmed: true };
    }
  }
  return next;
}
