/**
 * PC-29d (QA, Nov 25): the "working on it" line under Pau's avatar is for students. The
 * assignment-reading footer ("Still reading… 5s / Pau is only reading what the assignment says.
 * Questions come after.") belongs only to reading the assignment; after a chat send it read as
 * internal wording, so a reply wait shows one short, friendly line and nothing else.
 */
import { COACH_NAME } from "@/lib/stage1/pau-pau";

/** Reading (or extracting) the assignment itself, the only wait that gets the reading footer. */
export function isAssignmentRead(status: string): boolean {
  return /\b(reading the assignment|extracting the text|the assignment)\b/i.test(status);
}

/** A short, friendly student-facing status for a wait. */
export function friendlyStatus(status: string): string {
  const s = status.replace(/\s+/g, " ").trim();
  if (!s) return "One sec…";
  if (isAssignmentRead(s)) return s;
  if (/^digging it up/i.test(s)) {
    if (/key points/i.test(s)) return "Pulling together the key points…";
    if (/deeper/i.test(s)) return "Going a bit deeper…";
    if (/simpler/i.test(s)) return "Saying it simpler…";
    if (/readings/i.test(s)) return "Checking what I know about your readings…";
    return "Looking into that…";
  }
  return s;
}

/** The small line under the status: only while the assignment itself is being read. */
export function readingFooter(status: string, seconds: number): string | null {
  if (!isAssignmentRead(status)) return null;
  return `${seconds > 0 ? `Still reading… ${seconds}s. ` : ""}${COACH_NAME} is only reading what the assignment says. Questions come after.`;
}
