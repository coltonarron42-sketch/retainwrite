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

/** Drop filler so a casual phrase is not glued onto the assignment topic. */
export function cleanInterestPhrase(raw: string): string | null {
  const cleaned = raw.replace(FILLER, "").replace(/^["“”']+|["“”']+$/g, "").trim();
  if (cleaned.length < 3) return null;
  if (/^idk\b/i.test(cleaned)) return null;
  return cleaned.slice(0, 40);
}

export function buildStoryAngleFallback(input: {
  topic: string;
  studentPhrases: string[];
}): StoryAngle[] {
  const topic = (input.topic || "this assignment").trim().slice(0, 80);
  const phrase = input.studentPhrases
    .map((item) => cleanInterestPhrase(item))
    .find((item): item is string => Boolean(item));

  const angles: StoryAngle[] = [
    {
      id: "moment",
      question: `What's one moment from your own experience that shows ${topic}?`,
      whyFits: `Grounds the paper in a concrete detail that still answers ${topic}.`,
      fromStudentPhrase: phrase,
    },
    {
      id: "lead",
      question: `Which lead would you most like to dig into for ${topic}, and why?`,
      whyFits: "Connects research leads to the assignment's required angle.",
    },
    {
      id: "disagree",
      question: `What would someone who disagrees with you about ${topic} say?`,
      whyFits: "Sets up a counterargument the rubric often expects.",
    },
    {
      id: "change",
      question: phrase
        ? `You mentioned ${phrase}. Is there a moment there that speaks to this assignment?`
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
