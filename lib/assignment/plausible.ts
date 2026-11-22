/**
 * Sanity checks for facts read off an assignment sheet. The rule-based
 * fallback used to hand back fragments ("the prompt. Your thesis should appear
 * in") as the topic; these keep that from ever being said back as a fact.
 */

const INSTRUCTION =
  /\b(your thesis|should appear|must include|works cited|double[- ]spaced|font|margins?|due date|points?\b|rubric|submit|late work|cite every|citation style)\b/i;
const DANGLING_END = /\b(in|on|of|the|a|an|to|and|or|with|for|at|by|from|that|which|is|are|be)$/i;
const VAGUE_START = /^(the|this|that|your|our)\s+(prompt|assignment|paper|essay|question|topic|rest)\b/i;

export function plausibleTopic(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  const words = t.split(" ").length;
  if (words < 3 || t.length > 220) return false;
  // A sentence break inside: two sentences glued together, not a topic.
  if (/[.!?;:]\s+\S/.test(t.replace(/\b(?:U\.S|Dr|Mr|Mrs|Ms|Prof|St|vs|e\.g|i\.e)\./gi, "X"))) return false;
  if (INSTRUCTION.test(t)) return false;
  if (VAGUE_START.test(t)) return false;
  if (DANGLING_END.test(t.replace(/[?.!]+$/, ""))) return false;
  return true;
}

/** "Topic: X" on one line, or a "Topic" heading with X on the next line. */
export function labeledValue(text: string, labels: string[]): string | null {
  const lines = text.split(/\n/).map((line) => line.trim());
  const re = new RegExp(`^(?:${labels.map((l) => l.replace(/ /g, "\\s+")).join("|")})\\b\\s*[:\\-–]?\\s*(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(re);
    if (!m) continue;
    const rest = m[1]!.trim();
    if (rest) return rest;
    const next = lines.slice(i + 1).find((line) => line.length > 0);
    if (next) return next;
  }
  return null;
}
