/**
 * Pau Pau (POW-pow) is the coach. After the assignment is read, Pau Pau says
 * back what it understood in one conversational bubble, then asks for the one
 * most important missing thing, if any.
 * SOP: coaching only. These lines summarize the assignment sheet only; they
 * never contain paper content, theses or outlines.
 */
import { plausibleTopic } from "@/lib/assignment/plausible";
import { emptyRequirements } from "@/lib/assignment/schema";
import { indefiniteArticle, withArticle } from "@/lib/copy/articles";
import type { AssignmentRequirements } from "@/lib/assignment/schema";
import { isPlaceholderTopic } from "@/lib/assignment/parse-fallback";
import { withYear } from "@/lib/copy/due-date";
import { asQuestion, cleanTopic, isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";

export const COACH_NAME = "Pau Pau";
/** For speech synthesis, which otherwise says "paw paw". */
export const COACH_NAME_SPOKEN = "Pow pow";

export type PauPauAsk = "topic" | "sources" | "length";

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function count(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function citationPhrase(req: AssignmentRequirements): string | null {
  const style = req.citationStyle.value;
  if (!style) return null;
  if (style === "other") return req.citationStyleOther?.trim() ? `${req.citationStyleOther.trim()} format` : null;
  // Specific, as the sheet gives it: "MLA 9", "APA 7", "Chicago 17 notes-bibliography".
  const specific: Record<string, string> = {
    "Chicago 17 Notes": "Chicago 17 notes-bibliography",
    "Chicago 17 Author-Date": "Chicago 17 author-date",
  };
  return `${specific[style] ?? style} format`;
}

/** "PSYC 101 - Introduction to Psychology" → "PSYC 101"; plain names stay. */
function coursePhrase(req: AssignmentRequirements): string | null {
  const course = req.course.value?.replace(/\s+/g, " ").trim();
  if (!course) return null;
  const code = course.match(/^([A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\b/);
  if (code && course.length > code[1].length + 3) return code[1];
  return course.length > 48 ? course.slice(0, 48).replace(/\s+\S*$/, "") : course;
}

function instructorPhrase(req: AssignmentRequirements): string | null {
  const name = req.instructor?.value?.replace(/\s+/g, " ").trim();
  if (!name || name.length > 60) return null;
  return name;
}

function lengthPhrase(req: AssignmentRequirements): string | null {
  const length = req.length.value;
  if (!length) return null;
  const range = (a?: number, b?: number) =>
    a && b && a !== b ? `${a.toLocaleString("en-US")}–${b.toLocaleString("en-US")}` : a ? a.toLocaleString("en-US") : b ? b.toLocaleString("en-US") : null;
  const words = range(length.wordsMin, length.wordsMax);
  const pages = range(length.pagesMin, length.pagesMax);
  const type = paperNoun(req);
  if (pages) return `${indefiniteArticle(pages)} ${pages} page ${type}`;
  if (words) return `${indefiniteArticle(words)} ${words} word ${type}`;
  return null;
}

function paperNoun(req: AssignmentRequirements): string {
  const type = req.paperType.value?.toLowerCase().replace(/\s+/g, " ").trim();
  if (type && type.length <= 40 && /(essay|paper|report|reflection|analysis|review|memo|proposal|narrative|response)/.test(type)) {
    return type;
  }
  return "paper";
}

const CITATION_PAGE = /works cited|references? (page|list)|bibliography/i;

/** Required parts of the paper as short noun phrases (both lists: sheets file them either way). */
export function structurePhrases(req: AssignmentRequirements): string[] {
  const items = [...(req.structuralRequirements.value ?? []), ...(req.formattingRules.value ?? [])].map((item) =>
    item.replace(/\s+/g, " ").trim().replace(/[.;:]+$/, ""),
  );
  const out: string[] = [];
  const push = (phrase: string) => {
    if (!out.some((have) => have.toLowerCase() === phrase.toLowerCase())) out.push(phrase);
  };
  for (const item of items) {
    if (!item) continue;
    if (/title page|cover page/i.test(item)) push("a title page");
    else if (/\babstract\b/i.test(item)) push("an abstract");
    else if (/\bthesis\b/i.test(item))
      push(/intro|first paragraph|opening/i.test(item) ? "a clear thesis in your introduction" : "a clear thesis");
    else if (/counter-?argument|opposing view|other side/i.test(item)) push("a counterargument you answer");
    else if (/works cited/i.test(item)) push("a Works Cited page");
    else if (/bibliography/i.test(item)) push("a bibliography");
    else if (/references? (page|list)/i.test(item)) push("a References page");
    else if (/\bconclusion\b/i.test(item) && item.split(" ").length <= 4) push("a conclusion");
  }
  // Other short structural items that are already noun phrases ("an annotated outline").
  for (const item of req.structuralRequirements.value ?? []) {
    if (out.length >= 5) break;
    const text = item.replace(/\s+/g, " ").trim().replace(/[.;:]+$/, "").replace(/^(include|includes|including|add|write|have)\s+/i, "");
    if (!text || text.length > 60 || text.split(" ").length > 7) continue;
    if (/thesis|counter-?argument|works cited|references?|title page|abstract|conclusion|bibliography/i.test(text)) continue;
    if (/\b(should|must|will|needs? to|has to|have to|is|are)\b/i.test(text)) continue;
    const phrase = withArticle(text);
    if (phrase) push(phrase);
  }
  return out.slice(0, 5);
}

/** Key formatting worth saying out loud: spacing, font, margins (not the citation page). */
function formattingPhrase(req: AssignmentRequirements): string | null {
  const keep: string[] = [];
  for (const raw of req.formattingRules.value ?? []) {
    const item = raw.replace(/\s+/g, " ").trim().replace(/[.;:]+$/, "");
    // Length lives in the facts sentence only, so a corrected length never contradicts an old one here.
    if (/\b\d[\d,]*\s*(?:-|–|to)?\s*[\d,]*\s*(?:words?|pages?)\b/i.test(item)) continue;
    if (!item || CITATION_PAGE.test(item) || /title page|cover page|abstract|citation style|\b(mla|apa|chicago)\b/i.test(item)) continue;
    if (!/spac|font|pt\b|point|margin|times|arial|calibri|header|heading|page number|indent/i.test(item)) continue;
    if (item.length > 60) continue;
    keep.push(/^[A-Z][a-z]+\s+[A-Z]|^[A-Z]{2,}/.test(item) ? item : item.charAt(0).toLowerCase() + item.slice(1));
    if (keep.length >= 3) break;
  }
  return keep.length ? `Formatting: ${joinList(keep)}.` : null;
}

/** "Thesis & Argument (30%)", "Use of evidence" → "graded on thesis and argument, use of evidence…". */
function rubricPhrase(req: AssignmentRequirements): string | null {
  const names = (req.rubricCriteria.value ?? [])
    .map((c) =>
      c.name
        .replace(/\s*\(?\d+\s*(%|pts?|points)\)?/gi, "")
        .replace(/\s*[&/]\s*/g, " and ")
        .replace(/[:.\-–]+$/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((name) => name && name.length <= 40)
    .map((name) => name.split(" ").map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" "))
    .map((name) => name.replace(/\b(mla|apa|chicago)\b/gi, (m) => (m.toLowerCase() === "chicago" ? "Chicago" : m.toUpperCase())));
  if (!names.length) return null;
  return `You'll be graded on ${joinList(names.slice(0, 4))}.`;
}

/**
 * The named required source, shortened: `American Academy of Pediatrics. "School
 * Start Times for Adolescents." Pediatrics, 2014…` → `the American Academy of
 * Pediatrics' “School Start Times for Adolescents” (2014)`.
 */
export function namedSource(req: AssignmentRequirements): string | null {
  const sources = req.requiredSources.value;
  if (!sources) return null;
  const fromNotes = sources.notes?.replace(/^\s*must (include|use|cite):?\s*/i, "").trim();
  const fromTypes = sources.types?.match(/(?:including|one must be|must include)\s+(?:the\s+)?(.+)$/i)?.[1]?.trim();
  const raw = fromNotes || fromTypes;
  if (!raw) return null;
  const title = raw.match(/[“"]([^”"]{4,90})[”"]/)?.[1]?.replace(/[.,]+$/, "");
  const year = raw.match(/\b(19|20)\d{2}\b/)?.[0];
  const author = raw.split(/[.(“"]/)[0]?.trim().replace(/,$/, "");
  if (title && author && author.length <= 60) {
    const owner = `${/^the\b/i.test(author) ? "" : "the "}${author}${/s$/.test(author) ? "'" : "'s"}`;
    const lead = /^[A-Z][a-z]+,\s+[A-Z]/.test(author) ? `${author}'s` : owner; // "Smith, J." stays as is
    return `${lead} “${title}”${year ? ` (${year})` : ""}`;
  }
  const short = raw.split(/;\s*/)[0].replace(/\s+/g, " ").trim();
  if (short.length <= 90) return /^(the|a|an)\b/i.test(short) || /^[A-Z]/.test(short) ? short : `the ${short}`;
  return short.slice(0, 80).replace(/\s+\S*$/, "") + "…";
}

function sourcesPhrase(req: AssignmentRequirements): string | null {
  const sources = req.requiredSources.value;
  if (!sources) return null;
  const named = namedSource(req);
  const n = sources.countMin;
  let base: string | null = null;
  if (n) {
    const kind = /peer/i.test(`${sources.types ?? ""} ${sources.notes ?? ""}`)
      ? "peer-reviewed sources"
      : /scholarly/i.test(sources.types ?? "") || sources.scholarlyRequired
        ? "scholarly sources"
        : "sources";
    base = `at least ${count(n)} ${n === 1 ? kind.replace(/s$/, "") : kind}`;
  } else if (sources.types?.trim() && sources.types.length <= 80 && !named) {
    base = sources.types.trim().replace(/^use\s+/i, "").replace(/\.$/, "");
    base = base.charAt(0).toLowerCase() + base.slice(1);
  }
  if (named) return base ? `${base}, including ${named}` : `${named} as a source`;
  return base;
}

function topicLine(req: AssignmentRequirements): string | null {
  const topic = cleanTopic(req.topic.value) || cleanTopic(req.promptQuestion.value);
  if (!topic || isPlaceholderTopic(topic)) return null;
  if (isQuestionTopic(topic)) return `The big question: ${asQuestion(topic)}`;
  const mid = topicMidSentence(topic).replace(/[\s?]+$/, "");
  return mid.length <= 160 ? `You'll be writing about ${mid}.` : null;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

const SAID_BACK = [
  "course",
  "instructor",
  "paperType",
  "topic",
  "promptQuestion",
  "length",
  "citationStyle",
  "requiredSources",
  "dueDate",
  "rubricCriteria",
  "structuralRequirements",
  "formattingRules",
] as const;

/**
 * Only facts we're sure of get said back: confirmed by the student, or read
 * with confidence ≥ 0.6 (the model read, or a labeled line). A topic must also
 * look like a topic. Everything else is left out, and Pau Pau asks instead.
 */
export function trustedView(req: AssignmentRequirements): { view: AssignmentRequirements; skipped: number } {
  const empty = emptyRequirements();
  const view = { ...req };
  let skipped = 0;
  for (const key of SAID_BACK) {
    const field = req[key] as { value: unknown; confidence: number; confirmed?: boolean } | undefined;
    if (!field || field.value == null || (Array.isArray(field.value) && !field.value.length)) continue;
    let ok = Boolean(field.confirmed) || field.confidence >= 0.6;
    if (ok && !field.confirmed && (key === "topic" || key === "promptQuestion") && typeof field.value === "string") {
      ok = plausibleTopic(field.value);
    }
    if (!ok) {
      Object.assign(view, { [key]: empty[key] });
      if (key === "topic" || key === "length" || key === "citationStyle" || key === "requiredSources" || key === "course") skipped++;
    }
  }
  return { view, skipped };
}

/**
 * A small set of natural openers so the read-back doesn't always start the
 * same way. Picked by a stable seed (the paper id) so a reload says the same thing.
 * [lead-in, verb phrase before "<course>: <length>"].
 */
export const SUMMARY_OPENERS: ReadonlyArray<string> = [
  "Okay, I've read it.",
  "Got it.",
  "Alright, I read it through.",
  "Thanks, that helps.",
  "Okay, here's what I'm seeing.",
  "Okay, I've read it through.",
  "Alright, here's the gist.",
  "Great, I've got it.",
];

/**
 * Stable, well-mixed hash (FNV-1a + a final avalanche) so paper ids spread
 * evenly over the openers; the same paper always gets the same one.
 */
/**
 * The facts sentence, always a full sentence:
 * "This is for ENG 101 with Prof. Dana Ruiz: a 1,200 word essay in MLA 9 format."
 */
function factsSentence(course: string | null, instructor: string | null, what: string | null): string {
  const where = course && instructor ? `${course} with ${instructor}` : course ?? (instructor ? `${instructor}'s class` : null);
  if (where && what) return `This is for ${where}: ${what}.`;
  if (where) return `This is for ${where}.`;
  if (what) return `This is ${what}.`;
  return "";
}

export function openerIndex(seed: string | number | undefined): number {
  if (seed == null) return 0;
  if (typeof seed === "number") return Math.abs(Math.trunc(seed)) % SUMMARY_OPENERS.length;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) % SUMMARY_OPENERS.length;
}

export type SummaryOptions = {
  pendingAsk?: PauPauAsk | null;
  seed?: string | number;
  /** Facts only: no lead-in ("Got it.") and no closing line. For re-confirming after a correction. */
  bare?: boolean;
};

/**
 * What Pau Pau understood, as a few short chat bubbles, one idea each:
 * what it is → what it needs → how it's graded → when and what about → wrap-up.
 */
export function pauPauSummaryBubbles(full: AssignmentRequirements, opts: SummaryOptions = {}): string[] {
  const { view: req, skipped } = trustedView(full);
  const length = lengthPhrase(req);
  const citation = citationPhrase(req);
  const lead = SUMMARY_OPENERS[openerIndex(opts.seed)]!;
  const what = length ? `${length}${citation ? ` in ${citation}` : ""}` : citation ? `a paper in ${citation}` : null;
  const facts = factsSentence(coursePhrase(req), instructorPhrase(req), what);
  const opener = opts.bare ? facts : `${lead} ${facts}`.trim();

  const needs: string[] = [];
  const shape = structurePhrases(req);
  if (shape.length) needs.push(`You'll need ${joinList(shape)}.`);
  const sources = sourcesPhrase(req);
  if (sources) needs.push(`It calls for ${sources}.`);

  const graded: string[] = [];
  const formatting = formattingPhrase(req);
  if (formatting) graded.push(formatting);
  const rubric = rubricPhrase(req);
  if (rubric) graded.push(rubric);

  const whenWhat: string[] = [];
  const due = req.dueDate.value?.trim();
  if (due && due.length <= 60) whenWhat.push(`It's due ${withYear(due.replace(/^due:?\s*/i, "")) ?? due}.`);
  const topic = topicLine(req);
  if (topic) whenWhat.push(topic);

  let first = opener;
  let close: string;
  if (skipped) {
    if (first === lead) first = "Okay, I read through it.";
    close = "I couldn't make out every detail on the sheet, so I'll check a couple of things with you.";
  } else {
    close = opts.pendingAsk ? "That covers most of it." : "This is totally doable. You ready to get rolling?";
  }
  const tidy = (t: string) => t.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
  if (opts.bare) return [opener, needs.join(" "), graded.join(" "), whenWhat.join(" ")].map(tidy).filter(Boolean);
  return [first, needs.join(" "), graded.join(" "), whenWhat.join(" "), close].filter(Boolean).map(tidy);
}

/** How the student can answer the read-back: in their own words, in the same box. */
export const CONFIRM_INVITE = "If anything's off, just tell me in your own words.";
export const RECONFIRM_ASK = "Does that look right now? If so, we're ready to roll.";

/**
 * The read-back as ONE reply (PLAN.md 9): a few paragraphs in a single message,
 * ending with the one thing Pau Pau needs, or the invitation to confirm.
 */
export function readBackParas(full: AssignmentRequirements, opts: { pendingAsk?: PauPauAsk | null; seed?: string | number } = {}): string[] {
  const items = pauPauSummaryBubbles(full, opts);
  const close = items.pop() ?? "";
  const body = items;
  const paras = body.length > 2 ? [body.slice(0, 2).join(" "), body.slice(2).join(" ")] : body.length ? [body.join(" ")] : [];
  const ask = opts.pendingAsk ? PAU_PAU_ASK_TEXT[opts.pendingAsk] : CONFIRM_INVITE;
  paras.push(`${close} ${ask}`.trim());
  return paras;
}

/** After a correction: the updated facts, then "does that look right now?" (or the next missing thing). */
export function reconfirmParas(full: AssignmentRequirements, pendingAsk: PauPauAsk | null): string[] {
  const facts = pauPauSummaryBubbles(full, { bare: true }).join(" ").trim();
  return [facts ? `Here's what I have now. ${facts}` : "", pendingAsk ? PAU_PAU_ASK_TEXT[pendingAsk] : RECONFIRM_ASK].filter(Boolean);
}

/** The same read-back as one paragraph (read aloud, tests). */
export function pauPauSummary(full: AssignmentRequirements, opts: SummaryOptions = {}): string {
  return pauPauSummaryBubbles(full, opts).join(" ").replace(/\s+/g, " ").trim();
}

/** True when the sheet asks for sources the student has not given us yet. */
export function sourcesMissing(req: AssignmentRequirements): boolean {
  const sources = req.requiredSources.value;
  const asksForSources = Boolean(
    sources && (sources.countMin || sources.notes?.trim() || sources.types?.trim() || sources.scholarlyRequired),
  );
  const provided = (req.providedReadings.value ?? []).length + (req.providedSources?.value ?? []).length;
  return asksForSources && provided === 0;
}

/** The single most important missing thing, or null. Topic cannot be skipped. */
export function pauPauNextAsk(full: AssignmentRequirements, dismissed: ReadonlySet<PauPauAsk>): PauPauAsk | null {
  const req = trustedView(full).view;
  const topic = cleanTopic(req.topic.value) || cleanTopic(req.promptQuestion.value);
  if (!topic || isPlaceholderTopic(topic)) return "topic";
  if (!dismissed.has("sources") && sourcesMissing(req)) return "sources";
  if (!dismissed.has("length") && !req.length.value) return "length";
  return null;
}

export const PAU_PAU_ASK_TEXT: Record<PauPauAsk, string> = {
  topic:
    "Hmm, I couldn't find the actual prompt or topic on the sheet. Can you paste the prompt, or tell me what the paper is about in a few words?",
  sources:
    "Do you have any of the sources — a URL or PDF? The assignment calls for referencing them and I'd be a lot more helpful with that.",
  length: "One thing I couldn't spot: how long does it need to be? Words or pages is fine.",
};

/** "1,200-1,500 words", "5 pages", "about 800" → a length value. */
export function lengthFromAnswer(text: string): { wordsMin?: number; wordsMax?: number; pagesMin?: number; pagesMax?: number; raw: string } | null {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const nums = [...raw.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+/g)].map((m) => Number(m[0])).slice(0, 2);
  if (!nums.length) return { raw };
  const [a, b = nums[0]] = nums;
  if (/page/i.test(raw) || (a <= 30 && !/word/i.test(raw))) return { pagesMin: a, pagesMax: b, raw };
  return { wordsMin: a, wordsMax: b, raw };
}
