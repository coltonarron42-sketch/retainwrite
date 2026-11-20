import type { AssignmentRequirements, Field } from "@/lib/assignment/schema";

export type ConfirmGateResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

function isConfirmed(field: Field<unknown>): boolean {
  return field.confirmed === true;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Student must confirm every displayed field. Required before continue:
 * - topic OR promptQuestion (non-empty)
 * - length: a value OR explicit "Not specified" (confirmed with null/empty)
 * - citationStyle: a value OR explicit "Not specified" (other needs citationStyleOther)
 */
export function assertAssignmentConfirmGate(
  requirements: AssignmentRequirements,
): ConfirmGateResult {
  const reasons: string[] = [];

  const fields: [string, Field<unknown>][] = [
    ["course", requirements.course],
    ["paperType", requirements.paperType],
    ["topic", requirements.topic],
    ["promptQuestion", requirements.promptQuestion],
    ["length", requirements.length],
    ["citationStyle", requirements.citationStyle],
    ["formattingRules", requirements.formattingRules],
    ["requiredSources", requirements.requiredSources],
    ["providedReadings", requirements.providedReadings],
    ["structuralRequirements", requirements.structuralRequirements],
    ["dueDate", requirements.dueDate],
    ["rubricCriteria", requirements.rubricCriteria],
    ["otherInstructions", requirements.otherInstructions],
    ["aiPolicy", requirements.aiPolicy],
    ["language", requirements.language],
  ];

  for (const [name, field] of fields) {
    if (!isConfirmed(field)) {
      reasons.push(`${name} is not confirmed`);
    }
  }

  const hasTopic =
    hasText(requirements.topic.value) || hasText(requirements.promptQuestion.value);
  if (!hasTopic) {
    reasons.push("Add a topic or prompt question");
  }

  // Length: confirmed with a value, or confirmed missing ("Not specified")
  if (isConfirmed(requirements.length)) {
    const v = requirements.length.value;
    const hasValue =
      !!v &&
      (typeof v.pagesMin === "number" ||
        typeof v.pagesMax === "number" ||
        typeof v.wordsMin === "number" ||
        typeof v.wordsMax === "number" ||
        !!v.raw?.trim());
    const notSpecified =
      requirements.length.source === "student_entered" &&
      (v == null ||
        (!v.pagesMin &&
          !v.pagesMax &&
          !v.wordsMin &&
          !v.wordsMax &&
          !v.raw?.trim()));
    if (!hasValue && !notSpecified) {
      reasons.push('Length needs a value or "Not specified"');
    }
  }

  if (isConfirmed(requirements.citationStyle)) {
    const style = requirements.citationStyle.value;
    const notSpecified =
      requirements.citationStyle.source === "student_entered" && style == null;
    if (!style && !notSpecified) {
      reasons.push('Citation style needs a value or "Not specified"');
    }
    if (style === "other" && !requirements.citationStyleOther?.trim()) {
      reasons.push("Describe the other citation style");
    }
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

export function markFieldConfirmed<T>(
  field: Field<T>,
  edits?: Partial<Field<T>>,
): Field<T> {
  return {
    ...field,
    ...edits,
    confirmed: true,
    source: edits?.value !== undefined && edits.value !== field.value
      ? "student_edited"
      : field.source === "missing"
        ? "student_entered"
        : field.source,
  };
}

export function markNotSpecified<T>(field: Field<T>): Field<T> {
  return {
    value: null,
    confidence: 0,
    source: "student_entered",
    confirmed: true,
  };
}
