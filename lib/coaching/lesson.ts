// SOP: coaching only, never generate submission text

import { z } from "zod";

export const promptTypeSchema = z.enum([
  "lesson",
  "personal_experience",
  "mixed",
]);

export type PromptType = z.infer<typeof promptTypeSchema>;

export const lessonSchema = z.object({
  statement: z.string().max(200),
  why: z.string().max(160),
  concepts: z
    .array(
      z.object({
        term: z.string().max(60),
        rubricRef: z.string(),
      }),
    )
    .max(6),
  examplesServe: z.string().max(160).nullable(),
  evidence: z.object({
    file: z.string(),
    page: z.number().nullable(),
    quote: z.string().max(240),
  }),
  emotionalTerms: z.array(z.string().max(40)).max(4),
  confidence: z.number().min(0).max(1),
});

export type Lesson = z.infer<typeof lessonSchema>;

export type LessonExtraction = {
  lesson: Lesson;
  promptType: PromptType;
  promptTypeConfidence: number;
  source: "ai" | "student_edited" | "fallback";
};

const FEELING_WORDS = [
  "magical",
  "meaningful",
  "proud",
  "special",
  "challenging",
  "exciting",
  "peaceful",
];

const PERSONAL =
  /tell us about your|describe a time you|reflect on your|a time you/i;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function isVerbatimSubstring(quote: string, source: string): boolean {
  if (!quote.trim()) return false;
  return normalize(source).toLowerCase().includes(normalize(quote).toLowerCase());
}

/** A learning goal is a How/Why phrase or a noun phrase, never a claim sentence. */
export function isClaimSentence(statement: string): boolean {
  const text = statement.trim();
  if (/^(how|why)\b/i.test(text) && !/[.!?]$/.test(text)) return false;
  return (
    /[.!?]$/.test(text) &&
    /\b(is|are|was|were|should|must|will|shows|teaches)\b/i.test(text)
  );
}

export function guardLesson(
  lesson: Lesson,
  assignmentText: string,
): { ok: true } | { ok: false; reason: string } {
  if (isClaimSentence(lesson.statement)) {
    return { ok: false, reason: "statement is a claim sentence" };
  }
  if (!isVerbatimSubstring(lesson.evidence.quote, assignmentText)) {
    return { ok: false, reason: "evidence quote is not verbatim" };
  }
  for (const term of lesson.emotionalTerms) {
    if (!isVerbatimSubstring(term, assignmentText)) {
      return { ok: false, reason: "emotional term is not verbatim" };
    }
  }
  return { ok: true };
}

function firstSentence(prompt: string): string {
  const match = prompt.match(/^[\s\S]{1,200}?[.!](?=\s|$)/);
  return (match?.[0] ?? prompt).trim().slice(0, 200);
}

export function fallbackLesson(
  prompt: string,
  requiredStyles: string[] = [],
): LessonExtraction {
  const quote = firstSentence(prompt);
  const concepts = requiredStyles.slice(0, 6).map((term) => ({
    term: term.slice(0, 60),
    rubricRef: "required_style",
  }));
  const lesson: Lesson = {
    statement: quote,
    why: "The assignment asks for this work.",
    concepts,
    examplesServe: null,
    evidence: { file: "assignment", page: null, quote: quote.slice(0, 240) },
    emotionalTerms: [],
    confidence: 0.4,
  };
  return {
    lesson,
    promptType: "lesson",
    promptTypeConfidence: 0.4,
    source: "fallback",
  };
}

function emotionalTermsIn(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  return FEELING_WORDS.filter((word) => lower.includes(word)).slice(0, 4);
}

function hasConcept(prompt: string): boolean {
  return /leadership styles?|servant leadership|theory|framework|theme|device/i.test(
    prompt,
  );
}

export function classifyPrompt(prompt: string): {
  type: PromptType;
  confidence: number;
} {
  const personal = PERSONAL.test(prompt);
  const concept = hasConcept(prompt);
  if (personal && concept) return { type: "mixed", confidence: 0.86 };
  if (personal && !concept) return { type: "personal_experience", confidence: 0.9 };
  if (concept) return { type: "lesson", confidence: 0.9 };
  return { type: "lesson", confidence: 0.55 };
}

export function resolvePromptType(
  classification: { type: PromptType; confidence: number },
  studentChoice?: PromptType | null,
): PromptType {
  if (studentChoice) return studentChoice;
  if (classification.confidence < 0.6) return "lesson";
  return classification.type;
}

export function extractLesson(
  prompt: string,
  options?: {
    modelFailed?: boolean;
    requiredStyles?: string[];
    studentPromptType?: PromptType | null;
  },
): LessonExtraction {
  const text = prompt.trim();
  if (!text || options?.modelFailed) {
    return fallbackLesson(text, options?.requiredStyles);
  }

  const classification = classifyPrompt(text);
  const promptType = resolvePromptType(
    classification,
    options?.studentPromptType,
  );
  const feelings = emotionalTermsIn(text);

  if (promptType === "personal_experience") {
    const lesson: Lesson = {
      statement: "Moments from your experience and what they meant to you",
      why: "The prompt asks you to remember and reflect.",
      concepts: [],
      examplesServe: null,
      evidence: { file: "assignment", page: null, quote: firstSentence(text).slice(0, 240) },
      emotionalTerms: feelings,
      confidence: classification.confidence,
    };
    return {
      lesson,
      promptType,
      promptTypeConfidence: classification.confidence,
      source: "ai",
    };
  }

  const conceptTerm = /leadership styles/i.test(text)
    ? "leadership styles"
    : /servant leadership/i.test(text)
      ? "servant leadership"
      : "the assigned concept";

  const lesson: Lesson = {
    statement: /leadership styles/i.test(text)
      ? "How leadership styles show up in real leaders' choices"
      : `How ${conceptTerm} shows up in the examples you choose`,
    why: "The paper is assigned so you can learn the concept, then use examples to show it.",
    concepts: [{ term: conceptTerm, rubricRef: "lesson_concept" }],
    examplesServe: /example/i.test(text)
      ? "The examples serve the styles by showing them in action."
      : "Examples serve the concept.",
    evidence: { file: "assignment", page: null, quote: firstSentence(text).slice(0, 240) },
    emotionalTerms: promptType === "mixed" ? feelings : [],
    confidence: classification.confidence,
  };

  const guard = guardLesson(lesson, text);
  if (!guard.ok) return fallbackLesson(text, options?.requiredStyles);

  return {
    lesson,
    promptType,
    promptTypeConfidence: classification.confidence,
    source: "ai",
  };
}

export type RoadmapSection = {
  key: string;
  title: string;
  needs: string;
  concept?: string | null;
};

export function assignSectionModes<T extends RoadmapSection>(
  promptType: PromptType,
  sections: T[],
): Array<T & { mode: "lesson" | "memory"; concept: string | null }> {
  return sections.map((section) => {
    if (promptType === "personal_experience") {
      return { ...section, mode: "memory", concept: null };
    }
    if (promptType === "mixed") {
      const memory = /time you|your own|personal|moment|when you|experience/i.test(
        section.needs,
      );
      return {
        ...section,
        mode: memory ? "memory" : "lesson",
        concept: memory ? null : (section.concept ?? null),
      };
    }
    return {
      ...section,
      mode: "lesson",
      concept: section.concept ?? null,
    };
  });
}

export const LEADERSHIP_PROMPT =
  "Connect leadership styles to leaders you admire and give three examples.";

export const SUMMER_PROMPT =
  "Tell us about your summer vacation: three things that stood out and made it magical.";

export const MIXED_PROMPT =
  "Connect a leadership style to a time you led a group.";
