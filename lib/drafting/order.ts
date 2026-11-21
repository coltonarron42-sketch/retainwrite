// SOP: coaching only, never generate submission text

export type OrderParagraph = {
  key: string;
  sectionKey: string;
  status: "locked" | "open" | "saved" | "needs_review";
};

/** Reject a write that opens a later paragraph before the current one is saved. */
export function assertWriteInOrder(
  paragraphs: OrderParagraph[],
  targetKey: string,
): { ok: true } | { ok: false; reason: string } {
  const index = paragraphs.findIndex((row) => row.key === targetKey);
  if (index < 0) return { ok: false, reason: "Unknown paragraph." };
  for (const earlier of paragraphs.slice(0, index)) {
    if (earlier.status !== "saved") {
      return { ok: false, reason: "Finish the earlier section before writing ahead." };
    }
  }
  return { ok: true };
}

export function jumpTargetAllowed(
  paragraphs: OrderParagraph[],
  targetKey: string,
  currentKey: string,
): boolean {
  const target = paragraphs.findIndex((row) => row.key === targetKey);
  const current = paragraphs.findIndex((row) => row.key === currentKey);
  if (target < 0 || current < 0) return false;
  if (target > current) return false;
  return paragraphs[target]?.status === "saved" || target === current;
}
