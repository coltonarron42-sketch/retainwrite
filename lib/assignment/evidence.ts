/** rawEvidence must be a verbatim substring of the extracted prompt (case-insensitive). */
export function isVerbatimEvidence(
  evidence: string | undefined | null,
  sourceText: string,
): boolean {
  if (!evidence?.trim()) return false;
  return sourceText.toLowerCase().includes(evidence.trim().toLowerCase());
}

export function dropInvalidEvidence<T extends { rawEvidence?: string }>(
  field: T,
  sourceText: string,
): T {
  if (!field.rawEvidence) return field;
  if (isVerbatimEvidence(field.rawEvidence, sourceText)) return field;
  const { rawEvidence: _drop, ...rest } = field;
  return rest as T;
}
