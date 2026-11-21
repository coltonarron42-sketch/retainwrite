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
    return confirmed.slice(0, 140);
  }
  const concept = input.concept?.trim() ?? "";
  if (concept && !/^(the assigned concept|the concept)$/i.test(concept)) return concept.slice(0, 140);
  const fromText = topicLabel(null, input.assignmentText ?? "");
  if (fromText && !/^soc\s+\d+/i.test(fromText)) return fromText;
  return confirmed?.slice(0, 140) || "your topic";
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
  const subject = topic.trim() || "your topic";
  return `What would you search first? Try JSTOR, Google Scholar, or your school library for “${subject}”. Look for a peer-reviewed study or a report you can open, then check the author and the date. This is a direction, not a sentence to paste.`;
}

export function stageLessonHeader(subject: string, lessonStatement: string): string {
  if (subject && subject !== "your topic" && !/the assigned concept/i.test(subject)) {
    if (/the assigned concept/i.test(lessonStatement)) {
      return `How ${subject} shows up in the examples you choose`;
    }
    return lessonStatement;
  }
  return "What this assignment is asking you to learn";
}

export function topicLabel(concept: string | null, assignmentText: string): string | null {
  const cleaned = concept?.trim() ?? "";
  if (cleaned && cleaned.toLowerCase() !== "the concept") return cleaned.slice(0, 80);
  const sentence = assignmentText
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find((part) => part.split(/\s+/).filter(Boolean).length >= 4);
  return sentence ? sentence.slice(0, 90) : null;
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
  const subject = topic || (idea.split(/\s+/).length >= 4 ? idea.slice(0, 80) : "");
  if (!subject) {
    return { personalized: false, candidates: [], wildcard: null };
  }

  const ref = input.rubricRef;
  const candidates: LeadCandidate[] = [
    {
      name: `What should you look up first about ${subject}?`,
      rubricMatch: 0.9,
      rubricRef: ref,
      lessonLink: `About ${subject}`,
      whyFits: `Search JSTOR or your school library for “${subject}”. Open a study and notice what it measured. This is a question to pursue, not a sentence to paste.`,
    },
    {
      name: `What kind of source could show ${subject} in a real case?`,
      rubricMatch: 0.78,
      rubricRef: ref,
      lessonLink: `Shows ${subject}`,
      whyFits: `Look for a report or article about ${subject}. Check the author and the date yourself before you rely on it.`,
    },
    {
      name: idea
        ? `Which part of your thinking about ${subject} still needs a source you can open?`
        : `What would a reader expect you to verify about ${subject}?`,
      rubricMatch: idea ? 0.7 : 0.66,
      rubricRef: ref,
      lessonLink: `Fits ${subject}`,
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
      name: `Outside this class: where else ${subject} shows up`,
      rubricMatch: 0.22,
      rubricRef: ref,
      lessonLink: `Same pattern as ${subject}`,
      whyFits: "A stretch. The directions above stay closer to the assignment.",
      isWildcard: true,
      wildcardWhy: `Same pattern as ${subject}, in a field this assignment does not name.`,
      familyFriendly: true,
      controversyNote: null,
    },
  };
}

export function leadCopyIsTemplate(name: string): boolean {
  return GENERIC_TITLES.includes(name.trim().toLowerCase());
}
