import { tidyQuotePunct } from "@/lib/copy/quote-punct";
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
  const term = subject ? searchPhrase(subject) : "";
  const where = term
    ? `Try “${term}” in JSTOR, Google Scholar, or your school library, then add a word or two of your own.`
    : "Try a few words from your topic in JSTOR, Google Scholar, or your school library.";
  return `What would you search first? ${where} Look for a peer-reviewed study or a report you can open, then check the author and the date. This is a direction, not a sentence to paste.`;
}

/** The topic inside our own sentence ("This assignment teaches how…"). */
export function subjectMidSentence(subject: string): string {
  return topicMidSentence(subject);
}

/**
 * The Stance opener's purpose line. A subject that is really a question
 * ("whether high schools should start later") is something to argue, not a
 * lesson that "teaches" (QA 2:08 #7d).
 */
export function assignmentPurposeLine(subject: string): string {
  const mid = topicMidSentence(subject).replace(/[\s.?!]+$/, "");
  if (/^(whether|if)\b/i.test(mid)) return `This assignment asks you to argue ${mid.replace(/^if\b/i, "whether")}.`;
  if (/^(to what extent|how far)\b/i.test(mid)) return `This assignment asks you to argue ${mid}.`;
  if (/^(how|why|what|which|who|when|where)\b/i.test(mid)) return `This assignment asks you to explain ${mid}.`;
  if (/^(should|do|does|did|is|are|can|could|would|will|has|have)\b/i.test(mid)) return "This is the question your paper answers. We'll work through it one section at a time.";
  return `This assignment teaches ${mid}.`;
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

export function exampleLeadBatch(input: Parameters<typeof exampleLeadBatchRaw>[0]): ReturnType<typeof exampleLeadBatchRaw> {
  const out = exampleLeadBatchRaw(input);
  // Quote punctuation, straight or curly: “…morning?”, never “…”? or ?”? (QA 2:08 #7a).
  const tidy = (c: LeadCandidate): LeadCandidate => ({ ...c, name: tidyQuotePunct(c.name), whyFits: tidyQuotePunct(c.whyFits) });
  return { ...out, candidates: out.candidates.map(tidy), wildcard: out.wildcard ? tidy(out.wildcard) : null };
}

function exampleLeadBatchRaw(input: {
  concept: string | null;
  assignmentText: string;
  studentIdea: string;
  rubricRef: string;
  /** Section-specific titles (QA 10:38 #7): built from the section and the student's note. */
  section?: { key: string; title: string } | null;
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
  if (input.section) {
    // A clipped "how did…" prompt reads badly mid-sentence; call it "your question".
    return sectionLeadBatch({ section: input.section, subject, question: question || isClauseTopic(rawSubject), search, idea, ref });
  }
  const candidates: LeadCandidate[] = [
    {
      name: `What should you look up first about ${subject}?`,
      rubricMatch: 0.9,
      rubricRef: ref,
      lessonLink: `About ${subject}`,
      whyFits: `Try searching JSTOR or your school library for “${searchPhrase(search)}”, then narrow it with a word or two of your own. Open a study and notice what it measured. This is a question to pursue, not a sentence to paste.`,
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

const NOTE_LEAD_IN = /^(i think( that)?|i believe( that)?|my point is( that)?|in my opinion,?|i feel( like)?|honestly,?|so,?|basically,?)\s+/i;

/** The student's note as a short focus: “Social Security made the federal government…”. */
export function noteFocus(idea: string, words = 9): string {
  const t = idea.replace(/\s+/g, " ").trim().replace(NOTE_LEAD_IN, "").replace(NOTE_LEAD_IN, "");
  if (!t) return "";
  // A whole first clause reads better than a cut ("…morning, so I…").
  const clause = t.split(/[,;:.!?—]/)[0]!.trim();
  const n = clause.split(" ").length;
  if (n >= 3 && n <= words + 2) return clause;
  const parts = t.split(" ");
  const cut = parts.slice(0, words).join(" ").replace(/[,;:.!?]+$/, "");
  return parts.length > words ? `${cut}…` : cut;
}

function sectionRole(section: { key: string; title: string }): "intro" | "body" | "conclusion" | "other" {
  const t = `${section.key} ${section.title}`.toLowerCase();
  if (/intro/.test(t)) return "intro";
  if (/conclu/.test(t)) return "conclusion";
  if (/body|main|example|evidence|point|argument|analysis/.test(t)) return "body";
  return "other";
}

function sectionLeadBatch(ctx: {
  section: { key: string; title: string };
  subject: string;
  question: boolean;
  search: string;
  idea: string;
  ref: string;
}): { personalized: true; candidates: LeadCandidate[]; wildcard: LeadCandidate } {
  const { section, subject, question, idea, ref } = ctx;
  const part = section.title.toLowerCase();
  const role = sectionRole(section);
  const focus = idea ? noteFocus(idea) : "";
  const about = focus ? `“${focus}”` : question ? "your question" : subject;
  // Keywords only: never the student's raw sentence in a search box.
  const topicTerm = searchPhrase(ctx.search);
  const extra = idea ? noteKeywords(idea, topicTerm) : [];
  const term = cleanSearchTerm([topicTerm, ...extra].filter(Boolean).join(" "), ctx.search);
  const first =
    role === "intro"
      ? `What background should your introduction set up before ${about}?`
      : role === "conclusion"
        ? `What bigger stakes could your conclusion draw from ${about}?`
        : role === "body"
          ? `What evidence would back up ${about} in your ${part}?`
          : `What should your ${part} look up first about ${about}?`;
  const second =
    role === "intro"
      ? `What fact or moment could open your introduction on ${question ? "your question" : subject}?`
      : role === "conclusion"
        ? `What recent report shows why ${question ? "your question" : subject} still matters?`
        : `What real case could show ${about} in action?`;
  // Each section gets its own third direction (not one shared template).
  const third =
    role === "intro"
      ? idea
        ? `What would surprise a reader about ${about}?`
        : "What would surprise a reader who has never thought about this?"
      : role === "conclusion"
        ? idea
          ? `Who should act on ${about}, and what source backs that up?`
          : "Who should act on your answer, and what source backs that up?"
        : idea
          ? `Which part of ${about} still needs a source you can open?`
          : `What would a reader expect your ${part} to verify?`;
  return {
    personalized: true,
    candidates: [
      {
        name: first,
        rubricMatch: 0.9,
        rubricRef: ref,
        lessonLink: `For your ${part}`,
        whyFits: `Try searching JSTOR or your school library for “${term}”, then narrow it with a word or two of your own. This is a question to pursue, not a sentence to paste.`,
      },
      {
        name: second,
        rubricMatch: 0.78,
        rubricRef: ref,
        lessonLink: `Shows your ${part} in a real case`,
        whyFits: "Look for a report, study or news story you can open. Check the author and the date yourself before you rely on it.",
      },
      {
        name: third,
        rubricMatch: idea ? 0.7 : 0.66,
        rubricRef: ref,
        lessonLink: `Fits your ${part}`,
        whyFits: idea
          ? "Find one source that speaks to the claim you are least sure about, then explain that connection in your own words."
          : `Something this assignment would recognize as about ${subject}. Verify it before you cite it.`,
        ...(idea ? { studentNamed: true } : {}),
      },
    ],
    wildcard: {
      name: `Outside this class: where else ${focus ? `an idea like ${about}` : question ? "a question like yours" : subject} comes up`,
      rubricMatch: 0.22,
      rubricRef: ref,
      lessonLink: `Same pattern as your ${part}`,
      whyFits: "A stretch. The directions above stay closer to the assignment.",
      isWildcard: true,
      wildcardWhy: `Same pattern as your ${part}, in a field this assignment does not name.`,
      familyFriendly: true,
      controversyNote: null,
    },
  };
}

export function leadCopyIsTemplate(name: string): boolean {
  return GENERIC_TITLES.includes(name.trim().toLowerCase());
}

/** Words that make a note personal or chatty, not searchable. */
const NOTE_STOP = new Set([
  "i", "im", "i'm", "me", "my", "mine", "we", "our", "us", "you", "your", "he", "she", "his", "her", "him", "is", "are", "was", "were", "am",
  "so", "because", "but", "if", "then", "think", "feel", "believe", "know", "want", "guess", "should", "would", "could", "can", "will",
  "let", "make", "makes", "get", "gets", "go", "goes", "move", "every", "all", "always", "never", "just", "very", "really", "also",
  "sister", "brother", "mom", "mother", "dad", "father", "friend", "friends", "cousin", "family", "parents", "little", "older", "own",
  "honestly", "thing", "things", "something", "lot", "kind", "way", "point", "idea", "section", "paper",
]);

/** Up to three keywords from a note that the topic search doesn't already have. */
export function noteKeywords(idea: string, topicTerm = "", max = 3): string[] {
  const have = new Set(topicTerm.toLowerCase().split(/\s+/).map((w) => w.replace(/s$/, "")));
  const out: string[] = [];
  for (const raw of idea.toLowerCase().replace(/[^a-z'\s-]/g, " ").split(/\s+/)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (w.length < 4 || NOTE_STOP.has(w) || SEARCH_STOP.has(w) || have.has(w.replace(/s$/, "")) || out.includes(w)) continue;
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

// Words that make a search term read like a sentence fragment.
const FRAGMENT_STOP = new Set([
  "should", "would", "could", "can", "will", "shall", "may", "might", "must", "do", "does", "did", "is", "are", "was", "were", "be", "been",
  "has", "have", "had", "not", "no", "so", "because", "but", "if", "then", "when", "while", "which", "who", "what", "why", "how", "whether",
  "improve", "improves", "help", "helps", "helping", "need", "needs", "show", "shows", "learn", "means", "mean", "give", "gives", "take", "takes",
  "keep", "keeps", "let", "lets", "make", "makes", "get", "gets", "think", "feel", "want", "would", "us", "we", "our", "my", "i",
]);

/**
 * A library search term: 2-6 meaningful words, never a slice of the
 * student's sentence or a fragment like "should start later times improve"
 * (QA 2:08 #7c). Falls back to the topic's own words.
 */
export function cleanSearchTerm(term: string, fallback = ""): string {
  const pick = (text: string) => {
    const out: string[] = [];
    for (const raw of text.toLowerCase().replace(/[“”"?.!,;:()]/g, " ").split(/\s+/)) {
      const w = raw.replace(/^['-]+|['-]+$/g, "");
      if (!w || w.length < 3 && !/^\d/.test(w)) continue;
      if (SEARCH_STOP.has(w) || FRAGMENT_STOP.has(w) || /ly$/.test(w) || out.includes(w)) continue;
      out.push(w);
      if (out.length >= 6) break;
    }
    return out;
  };
  let words = pick(term);
  if (words.length < 2) words = pick(`${term} ${fallback}`);
  return words.slice(0, 6).join(" ");
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

/** The longest run of content words, as a search term: "high schools start later in the morning" → "high schools start later". */
export function searchPhrase(phrase: string): string {
  const groups = searchKeywords(phrase).split(", ").filter(Boolean);
  if (!groups.length) return phrase;
  return groups.reduce((best, g) => (g.split(" ").length > best.split(" ").length ? g : best), groups[0]!);
}
