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
      name: `Research on ${subject}`,
      rubricMatch: 0.9,
      rubricRef: ref,
      lessonLink: `About ${subject}`,
      whyFits: `Look for a real source about ${subject}. Check it yourself before you rely on it.`,
    },
    {
      name: `A real example of ${subject}`,
      rubricMatch: 0.78,
      rubricRef: ref,
      lessonLink: `Shows ${subject}`,
      whyFits: `A person, case, or event where ${subject} shows up. Verify the details yourself.`,
    },
    idea
      ? {
          name: "A direction close to what you wrote",
          rubricMatch: 0.7,
          rubricRef: ref,
          lessonLink: `Your idea about ${subject}`,
          whyFits: `You wrote: “${idea.slice(0, 120)}”. Find a source that speaks to that, then explain it in your own words.`,
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
