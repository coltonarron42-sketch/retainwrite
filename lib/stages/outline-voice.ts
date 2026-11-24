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

/**
 * "That's my outline for this section" / "let's move on" said to the coach, not outline content.
 * Returns their outline words with those trailing move-on clauses taken off (verbatim otherwise),
 * and whether they asked to move on.
 */
const MOVE_ON =
  /(?:^|[.!?,]\s*)(?:(?:ok(?:ay)?|so|and|yeah|alright)[,\s]+)*(?:that'?s (?:it|all|my outline|everything|all i (?:have|got))(?: i have)?(?: for (?:this|that|the) (?:section|part|one)| for now| here)?|i'?m (?:done|finished)(?: with (?:this|that) (?:section|part|one))?|(?:let'?s |we can )?(?:move on|go on|keep going)(?: to the next (?:one|section|part))?|next (?:section|part|one)|submit (?:it|that))[.!\s]*$/i;
export function splitOutlineControl(spoken: string): { line: string; moveOn: boolean } {
  let t = spoken.replace(/\s+/g, " ").trim();
  let moveOn = false;
  for (let i = 0; i < 3; i++) {
    const m = t.match(MOVE_ON);
    if (!m || m.index === undefined) break;
    moveOn = true;
    t = t.slice(0, m.index + (/^[.!?,]/.test(m[0]) ? 1 : 0)).replace(/[,\s]+$/, "").trim();
  }
  return { line: t, moveOn };
}
