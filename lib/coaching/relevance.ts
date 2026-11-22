/**
 * Is a Stance note about the assignment prompt? The model decides first; the
 * word-overlap rules (notesOnPrompt) are the fallback. Relevance is checked
 * before any critique of how the claim reasons (QA 10:38 #4, 11:48 #2).
 */
export const RELEVANCE_SYSTEM = `You check one student note against their assignment prompt.
Answer only whether the note is ABOUT the prompt's subject.
- On topic: any point, opinion, feeling, personal example or partial idea that relates to what the prompt asks, even if it is weak, short or one-sided. A specific detail of the prompt's subject counts (for a school start-time prompt: a time like 8:30, "first period", "the bell", "starting later", being tired in the morning).
- Off topic: the note is about a different subject (for example food preferences for a prompt about school start times), even if it shares an everyday word like "school".
Never judge quality or grammar. Never write or suggest text for the student.`;

export const RELEVANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { on_topic: { type: "boolean" } },
  required: ["on_topic"],
} as const;

export function parseRelevance(raw: unknown): boolean | null {
  const v = raw && typeof raw === "object" ? (raw as { on_topic?: unknown }).on_topic : undefined;
  return typeof v === "boolean" ? v : null;
}
