import { searchKeywords, searchPhrase } from "@/lib/coaching/exampleLeads";
import { topicSearchTerms } from "@/lib/copy/topic-phrase";
export type ResearchLeadDraft = {
  name: string;
  whyAssignment: string;
  whyInterest?: string | null;
  resourceType?: string;
  url?: string;
  searchTerms?: string;
  status: "to_verify";
  steeredBy: "assignment" | "interest" | "both" | "student";
  source: "intake_suggestion" | "student";
  hookOrExampleNote?: string;
};

export function createLead(input: {
  name: string;
  whyAssignment: string;
  whyInterest?: string | null;
  steeredBy?: ResearchLeadDraft["steeredBy"];
  scholarlyRequired?: boolean;
  resourceType?: string;
  searchTerms?: string;
}): ResearchLeadDraft {
  const steeredBy =
    input.steeredBy ??
    (input.whyInterest ? "both" : "assignment");

  if ((steeredBy === "interest" || steeredBy === "both") && !input.whyInterest?.trim()) {
    throw new Error("Interest-steered leads require a whyInterest line");
  }

  return {
    name: input.name.trim(),
    whyAssignment: input.whyAssignment.trim(),
    whyInterest: input.whyInterest?.trim() || null,
    resourceType: input.resourceType ?? "person",
    ...(input.searchTerms ? { searchTerms: input.searchTerms } : {}),
    status: "to_verify",
    steeredBy,
    source: "intake_suggestion",
    ...(input.scholarlyRequired
      ? {
          hookOrExampleNote:
            "Use this as a hook or example — still pair it with a scholarly source for Stage 4.",
        }
      : {}),
  };
}

export function assertLeadDefaults(lead: ResearchLeadDraft): void {
  if (lead.status !== "to_verify") {
    throw new Error("New intake leads must default to to_verify");
  }
  if (
    (lead.steeredBy === "interest" || lead.steeredBy === "both") &&
    !lead.whyInterest?.trim()
  ) {
    throw new Error("Interest-steered leads require both why-lines");
  }
}

/**
 * Pau Pau introduces research leads in her own voice (PLAN.md 9), then shows
 * links the student can open. Voice reads only this intro, never the links.
 */
export const LEADS_INTRO =
  "I pulled together a couple of places to start looking, based on your topic and what you told me. Tap a link to look around, and add the ones worth keeping. They're starting points to check later, not citations yet.";

export type LeadLink = { kind: "articles" | "news" | "videos"; label: string; href: string };

function terms(lead: ResearchLeadDraft, topic: string | null | undefined): string {
  if (lead.searchTerms?.trim()) return lead.searchTerms.trim();
  const t = (topic ?? "").replace(/[?.!]+$/, "").replace(/\s+/g, " ").trim().slice(0, 90);
  return t || lead.name;
}

/** Search links (never made-up articles): scholarly articles, news stories, videos. */
export function leadLinks(lead: ResearchLeadDraft, topic?: string | null): LeadLink[] {
  const q = encodeURIComponent(terms(lead, topic));
  return [
    { kind: "articles", label: "Articles (Google Scholar)", href: `https://scholar.google.com/scholar?q=${q}` },
    { kind: "news", label: "News stories", href: `https://www.google.com/search?tbm=nws&q=${q}` },
    { kind: "videos", label: "Videos (YouTube)", href: `https://www.youtube.com/results?search_query=${q}` },
  ];
}

/** Search words for a lead: the topic, plus the student's interest when it steers the lead. */
export function leadSearchTerms(topic: string | null | undefined, extra?: string | null): string | undefined {
  const t = (topic ?? "").replace(/[?.!]+$/, "").replace(/\s+/g, " ").trim().slice(0, 90);
  const out = [extra?.trim(), t].filter(Boolean).join(" ");
  return out || undefined;
}

function shortTopic(topic: string | null | undefined): string {
  return (topic ?? "").replace(/[?.!]+$/, "").replace(/\s+/g, " ").trim().slice(0, 70);
}

/**
 * The practitioner lead gets its own search: people who work on the topic
 * (interviews, case studies), plus the student's interest when there is one,
 * so it never repeats the plain topic search.
 */
export function practitionerSearchTerms(topic: string | null | undefined, interest?: string | null): string | undefined {
  const t = shortTopic(topic);
  if (!t) return undefined;
  return [t, "practitioner interview case study", interest?.trim()].filter(Boolean).join(" ");
}

const MEDIA_CUE = /\b(watch(?:ing|ed)?|show|shows|series|movie|movies|film|films|cartoon|anime|episode|episodes|tv|netflix|disney|hulu|book|books|novel|novels|podcast|podcasts|youtube|youtuber|album|song|songs|band|video game|game called)\b/i;
/** Everyday activities are never treated as a title ("I watch soccer" → soccer). */
const ACTIVITY = /^(soccer|football|basketball|baseball|softball|hockey|tennis|volleyball|swimming|running|track|golf|wrestling|lacrosse|gymnastics|cheer|dance|dancing|baking|cooking|music|art|drawing|painting|reading|writing|gaming|video games|games|sports|movies|anime|tv|history|science|math|cars|fashion|makeup|hiking|fishing|hunting|skateboarding|surfing|chess|theater|theatre|singing|guitar|piano|photography|animals|dogs|cats|horses)$/i;
const SMALL = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with"]);

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * How Pau Pau names the student's interest. A show, book or game title reads
 * "something from Bluey" (capitalized); an activity stays plain ("soccer").
 */
export function interestDisplay(tag: string, answers: string[] = []): { name: string; phrase: string; media: boolean } {
  const lower = tag.trim().toLowerCase();
  const src = answers.find((a) => a.toLowerCase().includes(lower)) ?? "";
  const at = src.toLowerCase().indexOf(lower);
  const original = at >= 0 ? src.slice(at, at + lower.length) : tag.trim();
  const capitalized = at > 0 && /^[A-Z]/.test(original) && !/[.!?]\s*$/.test(src.slice(0, at));
  const media = !ACTIVITY.test(lower) && (capitalized || MEDIA_CUE.test(src));
  const name = media ? (/[A-Z]/.test(original) ? original : titleCase(original)) : original.toLowerCase() === original ? original : lower;
  return { name, phrase: media ? `something from ${name}` : name, media };
}

const VERB_SPLIT = /\s+(?:change|changed|changes|affect|affects|affected|help|helps|make|makes|cause|causes|shape|shapes|influence|influences|impact|impacts|lead|leads)(?:\s+|$)/i;

/** One or two key phrases from the topic, named people/things first: “New Deal” and “relationship between Americans”. */
export function topicFocus(topic: string | null | undefined): string {
  const terms = topicSearchTerms(topic ?? "");
  if (!terms) return "";
  const groups = searchKeywords(terms)
    .split(", ")
    .flatMap((g) => g.split(VERB_SPLIT))
    .map((g) => g.trim())
    .filter(Boolean);
  if (!groups.length) return searchPhrase(terms);
  const named = groups.filter((g) => /[A-Z]/.test(g));
  const ordered = [...named, ...groups.filter((g) => !named.includes(g)).sort((a, b) => b.split(" ").length - a.split(" ").length)];
  const first = ordered[0]!;
  const second = ordered.slice(1).find((g) => g.split(" ").length >= 2);
  return second && first.split(" ").length < 3 ? `${first}” and “${second}` : first;
}

/** The practitioner lead's reason, specific to the topic and the student's interest. */
export function practitionerReason(topic: string | null | undefined, interest?: { name: string; media: boolean } | null): string {
  const focus = topicFocus(topic);
  const base = focus
    ? `A teacher, researcher or official who has dealt with “${focus}” firsthand, in an interview or a case study.`
    : "A teacher, researcher or official who has dealt with your question firsthand, in an interview or a case study.";
  if (!interest) return base;
  return `${base} Bonus if it connects to ${interest.media ? `something from ${interest.name}` : interest.name}.`;
}

/** A concrete one-line reason for the interest-steered example lead. */
export function exampleLeadWhy(interest: string, topic: string | null | undefined, answers: string[] = []): string {
  const d = interestDisplay(interest, answers);
  const t = shortTopic(topic);
  const full = (topic ?? "").replace(/[?.!]+$/, "").replace(/\s+/g, " ").trim();
  const lead = d.media ? `Something from ${d.name}` : `A real case from ${d.name}`;
  // Long prompts are never cut mid-sentence: name "the prompt's question" instead.
  return t && full.length <= 60
    ? `${lead} you can test your take on "${t}" against.`
    : `${lead} you can test your answer to the prompt's question against.`;
}
