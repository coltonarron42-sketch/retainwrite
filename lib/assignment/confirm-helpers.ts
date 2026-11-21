import type { Field } from "@/lib/assignment/schema";

export function markFieldConfirmed<T>(
  field: Field<T>,
  edits?: Partial<Field<T>>,
): Field<T> {
  return {
    ...field,
    ...edits,
    confirmed: true,
    source:
      edits?.value !== undefined && edits.value !== field.value
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
