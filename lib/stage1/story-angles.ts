import { splitSentences } from "@/lib/text/sentences";
import { isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";
/**
 * Rule-based story angle fallback (INTD600 Phase 2).
 * // SOP: coaching only, never generate submission text
 */

export type StoryAngle = {
  id: string;
  question: string;
  whyFits: string;
  fromStudentPhrase?: string;
};

const FILLER = /^(?:idk|i don't know|i dont know|not sure|whatever|n\/a|na|none|nothing)\b[\s,:-]*/i;

const DANGLING =
  /^(with|and|or|but|the|a|an|to|of|for|in|on|at|from|about|because|that|which|when|if)$/i;

/** Keep a whole clause. Drop a fragment that ends on a preposition or an ellipsis. */
export function clipToClause(raw: string, max = 72): string | null {
  const text = raw.replace(/…+/g, " ").replace(/\s+/g, " ").replace(/\?+/g, "").trim();
  if (!text || /^(paper|essay|assignment)$/i.test(text)) return null;
  const sentence = splitSentences(text)[0] ?? text;
  let clause = (sentence.split(/[,;:]/)[0] ?? sentence).replace(/[.!?]+$/g, "").trim();
  if (clause.length > max) {
    const cut = clause.slice(0, max);
    const boundary = cut.lastIndexOf(" ");
    clause = (boundary > 12 ? cut.slice(0, boundary) : cut).trim();
  }
  const words = clause.split(/\s+/).filter(Boolean);
  while (words.length > 2 && DANGLING.test(words[words.length - 1] ?? "")) words.pop();
  const clipped = words.join(" ").trim();
  if (!clipped || clipped.length < 3) return null;
  if (/^(paper|essay|assignment)$/i.test(clipped)) return null;
  if (DANGLING.test(clipped.split(/\s+/).at(-1) ?? "")) return null;
  return clipped;
}

/** Cut on a word boundary so a card does not end mid-word. */
export function clipPhrase(raw: string, max = 72): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text.replace(/[?!.,]+$/g, "").trim();
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > 12 ? cut.slice(0, boundary) : cut).replace(/[?!.,]+$/g, "").trim();
}

/** Drop filler so a casual phrase is not glued onto the assignment topic. */
export function cleanInterestPhrase(raw: string): string | null {
  const cleaned = raw.replace(FILLER, "").replace(/^["“”']+|["“”']+$/g, "").trim();
  if (cleaned.length < 3) return null;
  if (/^idk\b/i.test(cleaned)) return null;
  return clipToClause(cleaned, 72);
}

/** Only a finished sentence is safe to quote back as "You wrote, “…”". */
export function mentionablePhrase(raw: string): string | null {
  const text = raw.replace(/…+/g, " ").replace(/\s+/g, " ").trim();
  if (!text || /paper\?\?/i.test(text)) return null;
  const sentence = text.match(/^(.{8,90}?)[.!?](?:\s|$)/);
  if (!sentence) return null;
  const phrase = sentence[1].trim();
  if (!phrase || /^(paper|essay|assignment)$/i.test(phrase)) return null;
  if (DANGLING.test(phrase.split(/\s+/).at(-1) ?? "")) return null;
  return phrase;
}

export function usableStoryTopic(topic: string): string {
  if (/paper\?\?/i.test(topic)) return "this assignment";
  const cleaned = clipPhrase(topic.replace(/\?+/g, " "), 80);
  if (!cleaned || /^(paper|essay|assignment|this assignment)$/i.test(cleaned)) return "this assignment";
  return cleaned;
}

/** Their style word ("transformational") from a pick or the words around it. */
export function styleWordFrom(text: string): string | null {
  const m = (text ?? "").match(/\b(transformational|situational|servant|transactional|democratic|autocratic|authentic|laissez-faire|task|relationship|team management|behavioral)\b/i);
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Angles built on their decision (QA 8:31 AM walk C: the cards parroted the assignment).
 * Each is a real direction for THIS pick and leader, never the prompt read back.
 */
export function decisionAngles(d: { pick?: string | null; leader?: string | null }): StoryAngle[] | null {
  const style = d.pick?.trim() ? (styleWordFrom(d.pick) ?? d.pick.trim().toLowerCase()) : null;
  if (!style) return null;
  const who = d.leader?.trim() || null;
  const lead = who ?? "your leader";
  const styleName = /leadership$/.test(style) ? style : `${style} leadership`;
  return [
    {
      id: "turning",
      question: `When did ${lead} first show ${styleName} during the change, and what happened next?`,
      whyFits: "Gives your body one clear moment to build on.",
    },
    {
      id: "pushback",
      question: `Who pushed back on ${who ? `${who}'s` : "the"} change, and how was it handled?`,
      whyFits: "Shows the style under pressure, not just on a good day.",
    },
    {
      id: "contrast",
      question: `What would have gone differently with a different style in charge?`,
      whyFits: `Lets you show why ${styleName} beats the alternatives.`,
    },
    {
      id: "moment",
      question: `For this paper: a coach, boss or teacher you watched lead a group through a change like this. How did they use ${styleName}?`,
      whyFits: "Adds something you actually saw, in your own words.",
    },
  ];
}

export function buildStoryAngleFallback(input: {
  topic: string;
  studentPhrases: string[];
  decision?: { pick?: string | null; leader?: string | null } | null;
}): StoryAngle[] {
  const fromDecision = input.decision ? decisionAngles(input.decision) : null;
  if (fromDecision) return fromDecision;
  const usable = usableStoryTopic(input.topic || "this assignment");
  // "…disagrees with you about should high schools…" reads badly; refer to it.
  const topic =
    usable === "this assignment"
      ? usable
      : isQuestionTopic(input.topic)
        ? "the assignment's question"
        : topicMidSentence(usable);
  const phrase = input.studentPhrases
    .map((item) => mentionablePhrase(item))
    .find((item): item is string => Boolean(item));

  const angles: StoryAngle[] = [
    {
      id: "moment",
      question: "What's one moment from your own life that belongs in this paper?",
      whyFits: "Grounds the paper in a concrete detail you actually lived.",
      fromStudentPhrase: phrase,
    },
    {
      id: "lead",
      question: "Which example would you most like to dig into, and why?",
      whyFits: "Connects a source you can verify to the assignment.",
    },
    {
      id: "disagree",
      question: `What would someone who disagrees with you about ${topic} say?`,
      whyFits: "Sets up the other side without writing it for you.",
    },
    {
      id: "change",
      question: phrase
        ? `You wrote, “${phrase}.” Is there a moment there that speaks to this assignment?`
        : `What changed when you tried something related to ${topic}?`,
      whyFits: phrase
        ? "Uses something you already mentioned, without turning it into the whole prompt."
        : "Turns a personal detail into the paper's story spine.",
      fromStudentPhrase: phrase,
    },
  ];

  return angles.slice(0, 4).map((a) => ({
    ...a,
    question: a.question.endsWith("?") ? a.question : `${a.question}?`,
  }));
}

export function assertStoryAngleQuestion(text: string): boolean {
  const t = text.trim();
  return t.length >= 10 && t.length <= 200 && t.endsWith("?");
}
