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

export function buildStoryAngleFallback(input: {
  topic: string;
  studentPhrases: string[];
}): StoryAngle[] {
  const topic = (input.topic || "this assignment").trim().slice(0, 80);
  const phrase = input.studentPhrases.find((p) => p.trim().length >= 8)?.trim();

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
        ? `What changed for you around “${phrase.slice(0, 40)}”, and what does that say about ${topic}?`
        : `What changed when you tried something related to ${topic}?`,
      whyFits: "Turns a personal detail into the paper's story spine.",
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
