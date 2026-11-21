import type { AssignmentRequirements, Field } from "@/lib/assignment/schema";

/** Fields that trigger the single follow-up when missing or confidence < 0.4. */
const IMPORTANT: Array<keyof AssignmentRequirements> = [
  "topic",
  "promptQuestion",
  "length",
  "citationStyle",
  "rubricCriteria",
  "structuralRequirements",
];

function fieldWeak(field: Field<unknown> | undefined): boolean {
  if (!field || typeof field !== "object" || !("confidence" in field)) return true;
  const empty =
    field.value == null ||
    (typeof field.value === "string" && !field.value.trim()) ||
    (Array.isArray(field.value) && field.value.length === 0);
  return empty || field.confidence < 0.4 || field.source === "missing";
}

/**
 * True when prompt/format/length/rubric/structure look incomplete.
 * Topic OR promptQuestion counts as the prompt side.
 */
export function missingImportant(requirements: AssignmentRequirements): boolean {
  const promptOk =
    !fieldWeak(requirements.topic) || !fieldWeak(requirements.promptQuestion);
  if (!promptOk) return true;

  for (const key of IMPORTANT) {
    if (key === "topic" || key === "promptQuestion") continue;
    const field = requirements[key];
    if (field && typeof field === "object" && "confidence" in field) {
      if (fieldWeak(field as Field<unknown>)) return true;
    }
  }
  return false;
}
