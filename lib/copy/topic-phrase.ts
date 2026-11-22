/**
 * Splicing the student's topic into our sentences. Topics come in three forms:
 * a noun phrase ("Later school start times"), a clause ("How social media has
 * changed…") and a real question ("Should high schools start later?").
 */

const AUXILIARY_START =
  /^(should|shall|is|are|was|were|do|does|did|can|could|will|would|has|have|had|may|might|must)\b/i;
const CLAUSE_START = /^(how|why|what|whether|when|where|which|who|whose|to what extent|if)\b/i;
/** Lowercased mid-sentence; "The" and "A" stay capitalized only at the start. */
const LOWER_MID = /^(whether|how|why|what|when|where|which|who|whose|to what extent|if|the|a|an)\b/i;

export function cleanTopic(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().replace(/[\s.!,;:]+$/, "");
}

/** "Should high schools…", "How has social media changed…?" */
export function isQuestionTopic(text: string | null | undefined): boolean {
  const topic = cleanTopic(text);
  if (!topic) return false;
  return topic.endsWith("?") || AUXILIARY_START.test(topic);
}

/** "How social media has changed…" (no inversion, no "?"). */
export function isClauseTopic(text: string | null | undefined): boolean {
  const topic = cleanTopic(text);
  return Boolean(topic) && !isQuestionTopic(topic) && CLAUSE_START.test(topic);
}

/** The topic as a stand-alone question: capitalized, one "?" at the end. */
export function asQuestion(text: string | null | undefined): string {
  const topic = cleanTopic(text).replace(/[\s?]+$/, "");
  if (!topic) return "";
  return `${topic.charAt(0).toUpperCase()}${topic.slice(1)}?`;
}

/** The topic as a heading: capitalized, keeps a question mark only for questions. */
export function asHeading(text: string | null | undefined): string {
  if (isQuestionTopic(text)) return asQuestion(text);
  const topic = cleanTopic(text).replace(/[\s?]+$/, "");
  return topic ? `${topic.charAt(0).toUpperCase()}${topic.slice(1)}` : "";
}

/** The topic inside our own sentence: no trailing "?", lead word lowercased. */
export function topicMidSentence(text: string | null | undefined): string {
  const topic = cleanTopic(text).replace(/[\s?]+$/, "");
  return LOWER_MID.test(topic) ? topic.charAt(0).toLowerCase() + topic.slice(1) : topic;
}

/** For "…about X", "…related to X": a question topic is quoted as the question. */
export function topicAsObject(text: string | null | undefined): string {
  return topicRef(text);
}

/**
 * The topic as the object of our own sentence ("…about X", "…show X in a real
 * case"). A question can't sit there ("about Should schools…?"), so it is
 * referred to as "your question" instead.
 */
export function topicRef(text: string | null | undefined): string {
  if (isQuestionTopic(text)) return "your question";
  return topicMidSentence(text);
}

/** Words to type into a search box: no leading "Should/How/Why", no "?". */
export function topicSearchTerms(text: string | null | undefined): string {
  let topic = cleanTopic(text).replace(/[\s?]+$/, "");
  topic = topic.replace(/^(to what extent|in what ways?|whether|should|shall|is|are|was|were|do|does|did|can|could|will|would|has|have|had|may|might|must|how|why|what|when|where|which|who)\s+/i, "");
  topic = topic.replace(/^(do|does|did|is|are|has|have|should|can)\s+/i, "");
  return topic ? topic.charAt(0).toLowerCase() + topic.slice(1) : "";
}
