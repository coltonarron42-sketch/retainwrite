/**
 * Stage 3 on Grok Voice: how the student's spoken words join the outline box.
 * Their words are kept verbatim; Pau Pau never writes into the box.
 */

/** One spoken outline point = one line. The untouched Stance-notes prefill gives way to their spoken outline. */
export function addSpokenLine(box: string, spoken: string, notes: string): string {
  const t = spoken.replace(/\s+/g, " ").trim();
  if (!t) return box;
  const cur = box.replace(/\s+$/, "");
  if (!cur.trim() || cur.trim() === notes.trim()) return t;
  return `${cur}\n${t}`;
}

/** The student SAID the on-screen choice ("keep my notes" / "skip for now"): same as tapping it. */
export function outlineChoiceSaid(spoken: string, hasNotes: boolean): boolean {
  const t = spoken.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").toLowerCase();
  if (hasNotes) return /^(?:(?:ok(?:ay)?|yeah|yes),? )?(?:just )?(?:keep|use) (?:my )?(?:stance )?notes(?: as they are)?$/.test(t);
  return /^(?:(?:ok(?:ay)?|yeah),? )?skip(?: it| this(?: one)?)?(?: for now)?$/.test(t);
}
