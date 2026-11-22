import { asHeading, isClauseTopic, isQuestionTopic, topicMidSentence, topicRef, topicSearchTerms } from "@/lib/copy/topic-phrase";
import { clipWords } from "@/lib/copy/clip";
// SOP: coaching only, never generate submission text

import type { LeadCandidate } from "@/lib/coaching/leadBatch";
import { keptIdeas } from "@/lib/coaching/thin";

const GENERIC_TITLES = [
  "a source your field usually cites",
  "a second example from the same field",
  "a case your rubric can score",
  "a school jazz band director",
];

/** Prefer the confirmed topic or prompt over a file title or a placeholder. */
export function coachingSubject(input: {
  confirmedTopic?: string | null;
  confirmedPrompt?: string | null;
  concept?: string | null;
  assignmentText?: string | null;
}): string {
  const confirmed = input.confirmedTopic?.trim() || input.confirmedPrompt?.trim();
  if (confirmed && !/^(soc\s+\d+|the assigned concept|the concept)$/i.test(confirmed)) {
    return clipWords(confirmed, 140);
  }
  const concept = input.concept?.trim() ?? "";
  if (concept && !/^(the assigned concept|the concept)$/i.test(concept)) return clipWords(concept, 140);
  const fromText = topicLabel(null, input.assignmentText ?? "");
  if (fromText && !/^soc\s+\d+/i.test(fromText)) return fromText;
  return clipWords(confirmed, 140) || "your topic";
}

/** Course-title leads are not something a student can look up. */
export function visibleSourceLead(lead: string | null | undefined): string | null {
  const text = lead?.trim() ?? "";
  if (!text) return null;
  if (/^research on\b/i.test(text) && /\b(soc\s+\d+|argumentative essay|the assigned concept|your topic)\b/i.test(text)) {
    return null;
  }
  if (/^(soc\s+\d+|the assigned concept|your topic)\b/i.test(text)) return null;
  return text;
}

export function sourceSearchDirections(topic: string, _note?: string): string {
  const subject = topicSearchTerms(topic);
  const where = subject ? `with key words like ${searchKeywords(subject)}` : "with key words from your topic";
  return `What would you search first? Try JSTOR, Google Scholar, or your school library ${where}. Look for a peer-reviewed study or a report you can open, then check the author and the date. This is a direction, not a sentence to paste.`;
}

/** The topic inside our own sentence ("This assignment teaches how…"). */
export function subjectMidSentence(subject: string): string {
  return topicMidSentence(subject);
}

/**
 * A lesson statement read off the sheet by the rule fallback can be the course
 * header ("ENG 101: College Composition … Instructor: Prof. …"), not a lesson.
 */
export function lessonStatementUsable(statement: string | null | undefined): boolean {
  const s = (statement ?? "").trim();
  if (!s || s.length > 160 || /…$/.test(s)) return false;
  if (/the assigned concept/i.test(s)) return false;
  if (/\b(instructor|due(?: date)?|length|citation style|word count|points?)\s*:/i.test(s)) return false;
  if (/\bdepartment of\b|\b(fall|spring|summer|winter) 20\d\d\b|\s·\s/i.test(s)) return false;
  return true;
}

export function stageLessonHeader(subject: string, lessonStatement: string): string {
  if (subject && subject !== "your topic" && !/the assigned concept/i.test(subject)) {
    // The student's confirmed question is the best heading there is.
    if (isQuestionTopic(subject) || isClauseTopic(subject)) return asHeading(subject);
    if (lessonStatementUsable(lessonStatement)) return lessonStatement;
    return `How ${subject} shows up in the examples you choose`;
  }
  if (lessonStatementUsable(lessonStatement)) return lessonStatement;
  return "What this assignment is asking you to learn";
}

export function topicLabel(concept: string | null, assignmentText: string): string | null {
  const cleaned = concept?.trim() ?? "";
  if (cleaned && cleaned.toLowerCase() !== "the concept") return clipWords(cleaned, 80);
  const sentence = assignmentText
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find((part) => part.split(/\s+/).filter(Boolean).length >= 4);
  return sentence ? clipWords(sentence, 90) : null;
}

export function exampleLeadBatch(input: {
  concept: string | null;
  assignmentText: string;
  studentIdea: string;
  rubricRef: string;
}): {
  personalized: boolean;
  candidates: LeadCandidate[];
  wildcard: LeadCandidate | null;
} {
  const topic = topicLabel(input.concept, input.assignmentText);
  const idea = keptIdeas([input.studentIdea])[0] ?? "";
  const rawSubject = topic || (idea.split(/\s+/).length >= 4 ? clipWords(idea, 80) : "");
  if (!rawSubject) {
    return { personalized: false, candidates: [], wildcard: null };
  }
  const subject = topicRef(rawSubject);
  const question = isQuestionTopic(rawSubject);
  const search = topicSearchTerms(rawSubject) || subject;

  const ref = input.rubricRef;
  const candidates: LeadCandidate[] = [
    {
      name: `What should you look up first about ${subject}?`,
      rubricMatch: 0.9,
      rubricRef: ref,
      lessonLink: `About ${subject}`,
      whyFits: `Search JSTOR or your school library with key words from ${question ? "your question" : "your topic"}: ${searchKeywords(search)}. Open a study and notice what it measured. This is a question to pursue, not a sentence to paste.`,
    },
    {
      name: question
        ? "What kind of source could show your question playing out in a real case?"
        : `What kind of source could show ${subject} in a real case?`,
      rubricMatch: 0.78,
      rubricRef: ref,
      lessonLink: question ? "Shows your question in a real case" : `Shows ${subject}`,
      whyFits: `${question ? "Look for a report or article that speaks to your question." : `Look for a report or article about ${subject}.`} Check the author and the date yourself before you rely on it.`,
    },
    {
      name: idea
        ? `Which part of your thinking about ${subject} still needs a source you can open?`
        : `What would a reader expect you to verify about ${subject}?`,
      rubricMatch: idea ? 0.7 : 0.66,
      rubricRef: ref,
      lessonLink: question ? "Fits your question" : `Fits ${subject}`,
      whyFits: idea
        ? `You already have a note. Find one source that speaks to the claim you are least sure about, then explain that connection in your own words.`
        : `Something this assignment would recognize as about ${subject}. Verify it before you cite it.`,
      ...(idea ? { studentNamed: true } : {}),
    },
  ];

  return {
    personalized: true,
    candidates,
    wildcard: {
      name: question ? "Outside this class: where else a question like yours comes up" : `Outside this class: where else ${subject} shows up`,
      rubricMatch: 0.22,
      rubricRef: ref,
      lessonLink: question ? "Same pattern as your question" : `Same pattern as ${subject}`,
      whyFits: "A stretch. The directions above stay closer to the assignment.",
      isWildcard: true,
      wildcardWhy: `Same pattern as ${question ? "your question" : subject}, in a field this assignment does not name.`,
      familyFriendly: true,
      controversyNote: null,
    },
  };
}

export function leadCopyIsTemplate(name: string): boolean {
  return GENERIC_TITLES.includes(name.trim().toLowerCase());
}

const SEARCH_STOP = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "be", "it", "its", "their", "they", "them", "this", "that", "with", "by", "from", "as", "into", "more", "most", "than", "really", "actually"]);

/** "high schools start later in the morning" → "high schools, start later, morning" (whole words, no grammar to break). */
export function searchKeywords(phrase: string): string {
  const groups: string[] = [];
  let current: string[] = [];
  for (const word of phrase.replace(/[“”"?.!,;:]/g, " ").split(/\s+/).filter(Boolean)) {
    if (SEARCH_STOP.has(word.toLowerCase())) {
      if (current.length) groups.push(current.join(" "));
      current = [];
    } else current.push(word);
  }
  if (current.length) groups.push(current.join(" "));
  return groups.slice(0, 4).join(", ") || phrase;
}
