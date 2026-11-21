/** Continue is allowed when the student has files, optional text, or links — paste is never required. */
export function canStartAssignmentParse(input: {
  fileCount: number;
  pasteText: string;
  linkCount: number;
  rightsOk: boolean;
}): boolean {
  if (!input.rightsOk) return false;
  return (
    input.fileCount > 0 ||
    Boolean(input.pasteText.trim()) ||
    input.linkCount > 0
  );
}
