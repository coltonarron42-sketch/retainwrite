/**
 * Backstop for the realtime voice: Pau Pau coaches, she never writes the paper.
 * The relay watches her live transcript and cancels a reply that turns into
 * paper text. The instructions and tools are the main defense; this is the net.
 */
const ESSAY_LEADS: RegExp[] = [
  /\bhere(?:'s| is| are)\s+(?:a|an|your|the|my|some)?\s*(?:draft|sample|example|possible|quick|short|rough)?\s*(?:thesis|intro(?:duction)?|opening|paragraph|conclusion|essay|outline|topic sentence|first sentence|body paragraph|hook)s?\b/i,
  /\b(?:you could|you can|try|maybe)\s+(?:write|say|put|start (?:it )?with|open with)\s*(?:something like)?\s*[:,]?\s*["“'‘]/i,
  /\byour (?:thesis|intro(?:duction)?|opening (?:line|sentence)|topic sentence|conclusion) (?:could|should|might) (?:be|read|say)\s*[:,]?\s*["“'‘]?/i,
  /\bin conclusion,/i,
  /\bin today'?s (?:society|world),/i,
  /\bthroughout history,/i,
  /\bfirst(?:ly)?, .{10,}\. second(?:ly)?, /i,
  /\bi(?:'ll| will) (?:write|draft) (?:it|that|this|your|the|a)\b/i,
  /\bhere(?:'s| is) how (?:i'?d|i would) (?:write|phrase|word) it\b/i,
];

/** Her replies are short and end on a question; a long monologue is a red flag. */
export const MAX_REPLY_WORDS = 110;

export type GuardVerdict = { block: false } | { block: true; reason: string };

export function essayGuard(transcript: string): GuardVerdict {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return { block: false };
  for (const re of ESSAY_LEADS) if (re.test(text)) return { block: true, reason: `pattern:${re.source.slice(0, 40)}` };
  const words = text.split(" ").length;
  if (words > MAX_REPLY_WORDS) return { block: true, reason: `long:${words}` };
  return { block: false };
}

/** Spoken by force_message (no model) after a cancelled reply. */
export const GUARD_REDIRECTS = [
  "Nope, that one's yours to write. Tell me your first idea and I'll push on it.",
  "I'll stop myself there. The words have to be yours. What's the first thing you want to say?",
  "Can't write it for you, no thumbs. What's your take? Say it rough, we'll sharpen it.",
] as const;

/**
 * save_note must carry the student's own words. A note the model made up
 * (mostly words the student never said) is refused.
 */
export function wordsFromStudent(note: string, studentSaid: string[]): number {
  const tok = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const said = new Set(studentSaid.flatMap(tok));
  const words = tok(note);
  if (!words.length) return 0;
  return words.filter((w) => said.has(w)).length / words.length;
}
