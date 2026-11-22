import { isPlaceholderTopic } from "@/lib/assignment/parse-fallback";

/** Trailing "?", "." or spaces would double up with our own punctuation. */
function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().replace(/[\s?.!]+$/, "");
}

/**
 * The early-stance question asks about the assignment itself: the confirmed
 * topic, else the assignment's own question, else plain wording. It never wraps
 * the story-angle prompt (that produced "early take on: What's one moment…?").
 */
export function earlyStanceQuestion(input: {
  topic?: string | null;
  promptQuestion?: string | null;
}): string {
  const topic = clean(input.topic);
  if (topic && !isPlaceholderTopic(topic) && !topic.includes("?")) {
    return `What's your early take on ${topic}?`;
  }
  const prompt = clean(input.promptQuestion);
  if (prompt) return `The assignment asks: ${prompt}? What's your early take?`;
  return "What's your early take on this assignment?";
}

export const EARLY_STANCE_MIN_NOTE = "(at least 25 words)";
