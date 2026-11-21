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

const KEYWORD_STOP = new Set([
  "this", "that", "with", "from", "your", "about", "have", "what", "when", "where",
  "which", "would", "could", "their", "there", "they", "them", "into", "than",
  "then", "just", "like", "some", "more", "also", "been", "were", "because",
  "after", "before", "want", "look", "looking", "really", "very",
]);

/** A few words from the student's note, for a search box rather than a sentence to paste. */
export function searchKeywords(note: string, topic: string): string {
  const words = note
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 3 && !KEYWORD_STOP.has(word));
  const unique = [...new Set(words)].slice(0, 4);
  if (unique.length >= 2) return unique.join(" ");
  const fromTopic = topic
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 6);
  return fromTopic.join(" ") || topic.slice(0, 80);
}

export function sourceSearchDirections(topic: string, note: string): string {
  const keywords = searchKeywords(note, topic);
  return `Search JSTOR, Google Scholar, or your school library for “${keywords}”. Look for a peer-reviewed study or a report you can open. Check the author and the date, then decide if it fits. This is a direction, not a sentence to paste.`;
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
  const keywords = searchKeywords(idea, subject);
  const candidates: LeadCandidate[] = [
    {
      name: `A peer-reviewed study on ${keywords}`,
      rubricMatch: 0.9,
      rubricRef: ref,
      lessonLink: `About ${subject}`,
      whyFits: `Search JSTOR or your school library for “${keywords}”. Open the study and decide if it fits ${subject}. This is a direction, not a sentence to paste.`,
    },
    {
      name: `A report you can check on ${keywords}`,
      rubricMatch: 0.78,
      rubricRef: ref,
      lessonLink: `Shows ${subject}`,
      whyFits: `Look for a report or article about ${keywords}. Check the author and the date yourself before you rely on it.`,
    },
    idea
      ? {
          name: "A source that speaks to what you wrote",
          rubricMatch: 0.7,
          rubricRef: ref,
          lessonLink: `Your note about ${keywords}`,
          whyFits: `Your note mentions ${keywords}. Find one source about that, then explain the connection in your own words.`,
          studentNamed: true,
        }
      : {
          name: `A source a reader would connect to ${subject}`,
          rubricMatch: 0.66,
          rubricRef: ref,
          lessonLink: `Fits ${subject}`,
          whyFits: `Something this assignment would recognize as about ${subject}. Verify it before you cite it.`,
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
