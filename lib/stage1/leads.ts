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

/** A concrete one-line reason for the interest-steered example lead. */
export function exampleLeadWhy(interest: string, topic: string | null | undefined): string {
  const t = shortTopic(topic);
  return t
    ? `A real case from ${interest} you can test your take on "${t}" against.`
    : `A real case from ${interest} you can test your take against.`;
}
