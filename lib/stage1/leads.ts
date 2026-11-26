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
 * Pau introduces research leads in her own voice (PLAN.md 9), then shows
 * links the student can open. Voice reads only this intro, never the links.
 */
export const LEADS_INTRO =
  "I pulled together a couple of places to start looking, based on your topic and what you told me. Tap a link to look around, and add the ones worth keeping. They're starting points to check later, not citations yet.";

export type LeadLink = { kind: "articles" | "news" | "videos"; label: string; href: string };

function terms(lead: ResearchLeadDraft, topic: string | null | undefined): string {
  // Saved terms from older leads may be cut mid-word ("…through ch"): never pass a broken last word on.
  if (lead.searchTerms?.trim()) return lead.searchTerms.trim();
  return searchQuery(topic) || lead.name;
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

/** What the student chose, for a sharper search: their leader and styles. */
export type SearchPicks = { leader?: string | null; styles?: string[] };

const QUERY_STOP = new Set(
  "a an the and or of in on at to for with by from as is are was were be been being which what who whom whose how why when where whether that this these those it its do does did can could should would will most more best effective really very one real your you their them they he she his her our we us i my using use used through into about than then so if not no essay paper argue arguing argues write explain discuss".split(" "),
);

/** Trim to `max` characters at a word boundary (never mid-word). */
export function trimAtWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : t.slice(0, max)).trim();
}

/** The topic's core terms ("leadership style leading team change"), never the question's filler words. */
export function topicKeywords(topic: string | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of String(topic ?? "").replace(/[“”"'’?!.,;:()]/g, " ").split(/\s+/)) {
    const w = raw.trim();
    const lw = w.toLowerCase();
    if (!w || lw.length < 3 || QUERY_STOP.has(lw) || /^\d/.test(lw) || out.some((x) => x.toLowerCase() === lw)) continue;
    out.push(/^[A-Z][a-z]/.test(w) && out.length > 0 ? w : lw);
  }
  return out;
}

/**
 * QA (#78 gate): a search query from keywords (their leader, their styles, the topic's core terms),
 * trimmed at a word boundary: never "…leading a team through ch practitioner interview c…".
 */
export function searchQuery(topic: string | null | undefined, picks: SearchPicks = {}, tail: string[] = [], max = 90): string {
  const lead = [picks.leader?.trim(), ...(picks.styles ?? []).map((s) => s.trim().toLowerCase())].filter((x): x is string => Boolean(x));
  const have = lead.join(" ").toLowerCase();
  const core = topicKeywords(topic).filter((w) => !have.split(/\s+/).includes(w.toLowerCase()));
  const end = tail.map((x) => x.trim()).filter(Boolean).join(" ");
  const room = Math.max(10, max - (end ? end.length + 1 : 0));
  const head = trimAtWord([...lead, ...core].join(" "), room);
  return trimAtWord([head, end].filter(Boolean).join(" "), max + (end ? end.length : 0));
}

/** Search words for a lead: the student's interest when it steers the lead, then their picks and the topic's keywords. */
export function leadSearchTerms(topic: string | null | undefined, extra?: string | null, picks: SearchPicks = {}): string | undefined {
  const out = [extra?.trim(), searchQuery(topic, picks)].filter(Boolean).join(" ");
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
export function practitionerSearchTerms(topic: string | null | undefined, interest?: string | null, picks: SearchPicks = {}): string | undefined {
  if (!shortTopic(topic)) return undefined;
  return searchQuery(topic, picks, ["practitioner interview case study", interest?.trim() ?? ""], 100);
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
 * How Pau names the student's interest. A show, book or game title reads
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
  // QA 6:03 AM: never an instruction fragment ("using one real leader") or a dangling verb ("leadership style is").
  const raw = topicFocus(topic).replace(/\s+(?:is|are|was|were|has|have|does|do|can|should|will)$/i, "").trim();
  // Never a fragment of the instructions ("two readings say about…") or a verb phrase ("hurts memory").
  const awkward =
    /^(?:using|use|one real|your|a real)\b/i.test(raw) ||
    /\b(?:readings?|says?|said|the two|assignment|prompt|agree|essay|paper|words)\b/i.test(raw) ||
    /^(?:hurts?|helps?|affects?|changes?|makes?|causes?|leads?|shapes?|improves?|harms?)\b/i.test(raw) ||
    raw.split(/\s+/).length > 6;
  const focus = awkward || (raw.split(/\s+/).length < 2 && raw.length < 5) ? "" : raw;
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
  // Keep the prompt's own "?" inside the quote.
  const quoted = /\?\s*$/.test(topic ?? "") ? `${t}?` : t;
  return t && full.length <= 60
    ? `${lead} you can test your take on “${quoted}” against.`
    : `${lead} you can test your answer to the prompt's question against.`;
}
