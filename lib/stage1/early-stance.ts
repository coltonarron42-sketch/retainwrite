import { isPlaceholderTopic } from "@/lib/assignment/parse-fallback";
import { asQuestion, cleanTopic, isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";

/**
 * The early-stance question asks about the assignment itself: the confirmed
 * topic, else the assignment's own question, else plain wording. It never wraps
 * the story-angle prompt (that produced "early take on: What's one moment…?").
 * A question-form topic ("Should high schools…") is asked as its own question
 * instead of spliced in ("early take on should high schools…").
 */
export function earlyStanceQuestion(input: {
  topic?: string | null;
  promptQuestion?: string | null;
}): string {
  const topic = cleanTopic(input.topic);
  if (topic && !isPlaceholderTopic(topic)) {
    if (isQuestionTopic(topic)) return `${asQuestion(topic)} What's your early take?`;
    return `What's your early take on ${topicMidSentence(topic)}?`;
  }
  const prompt = cleanTopic(input.promptQuestion);
  if (prompt) return `The assignment asks: ${asQuestion(prompt)} What's your early take?`;
  return "What's your early take on this assignment?";
}

export const EARLY_STANCE_MIN_NOTE = "A few sentences is perfect.";
