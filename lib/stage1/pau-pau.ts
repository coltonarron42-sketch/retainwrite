/**
 * Pau Pau (POW-pow) is the coach. After the assignment is read, Pau Pau says
 * back what it understood in one conversational bubble, then asks for the one
 * most important missing thing, if any.
 * SOP: coaching only. These lines summarize the assignment sheet only; they
 * never contain paper content, theses or outlines.
 */
import type { AssignmentRequirements } from "@/lib/assignment/schema";
import { isPlaceholderTopic } from "@/lib/assignment/parse-fallback";
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
  const short = style.replace(/\s+\d+$/, "").replace(/\s+17\s+/, " ");
  return `${short} format`;
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
  return `${name}${/s$/i.test(name) ? "'" : "'s"} class`;
}

function lengthPhrase(req: AssignmentRequirements): string | null {
  const length = req.length.value;
  if (!length) return null;
  const range = (a?: number, b?: number) =>
    a && b && a !== b ? `${a.toLocaleString("en-US")}–${b.toLocaleString("en-US")}` : a ? a.toLocaleString("en-US") : b ? b.toLocaleString("en-US") : null;
  const words = range(length.wordsMin, length.wordsMax);
  const pages = range(length.pagesMin, length.pagesMax);
  const type = paperNoun(req);
  if (pages) return `a ${pages} page ${type}`;
  if (words) return `a ${words} word ${type}`;
  return null;
}

function paperNoun(req: AssignmentRequirements): string {
  const type = req.paperType.value?.toLowerCase().replace(/\s+/g, " ").trim();
  if (type && type.length <= 40 && /(essay|paper|report|reflection|analysis|review|memo|proposal|narrative|response)/.test(type)) {
    return type;
  }
  return "paper";
}

function structurePhrases(req: AssignmentRequirements): string[] {
  const out: string[] = [];
  const rules = (req.formattingRules.value ?? []).join(" ").toLowerCase();
  if (/title page|cover page/.test(rules)) out.push("a title page");
  for (const item of req.structuralRequirements.value ?? []) {
    const text = item
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.;:]+$/, "")
      .replace(/^(include|includes|including|add|write|have)\s+/i, "");
    // Short noun phrases only; full instructions ("a thesis should appear…") read badly here.
    if (!text || text.length > 70 || text.split(" ").length > 8) continue;
    if (/\b(should|must|will|needs? to|has to|have to|is|are)\b/i.test(text)) continue;
    const lower = text.charAt(0).toLowerCase() + text.slice(1);
    out.push(/^(a|an|the|one|two|three|include|use|each|every)\b/i.test(lower) ? lower : `a ${lower}`);
    if (out.length >= 3) break;
  }
  return out;
}

function sourcesPhrase(req: AssignmentRequirements): string | null {
  const sources = req.requiredSources.value;
  if (!sources) return null;
  const named = sources.notes?.replace(/^must include:\s*/i, "").split(/;\s*/)[0]?.trim();
  const n = sources.countMin;
  let base: string | null = null;
  if (n) {
    const kind = /scholarly|peer/i.test(sources.types ?? "") ? "scholarly sources" : "sources";
    base = `at least ${count(n)} ${n === 1 ? kind.replace(/s$/, "") : kind}`;
  } else if (sources.types?.trim() && sources.types.length <= 80) {
    base = sources.types.trim().replace(/^use\s+/i, "").replace(/\.$/, "");
    base = base.charAt(0).toLowerCase() + base.slice(1);
  }
  if (named && named.length <= 90) return base ? `${base}, including ${named}` : `sources including ${named}`;
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

/** What Pau Pau understood, as one conversational paragraph. */
export function pauPauSummary(req: AssignmentRequirements, opts: { pendingAsk?: PauPauAsk | null } = {}): string {
  const first = [citationPhrase(req), coursePhrase(req), instructorPhrase(req)].filter(
    (item): item is string => Boolean(item),
  );
  const shape = [lengthPhrase(req), ...structurePhrases(req)].filter((item): item is string => Boolean(item));
  const sources = sourcesPhrase(req);
  const due = req.dueDate.value?.trim();

  const all = [...first, ...shape];
  let opener = "Okay, let's see here…";
  if (all.length && sources) opener += ` looks like ${all.join(", ")}, and ${sources}.`;
  else if (all.length) opener += ` looks like ${joinList(all)}.`;
  else if (sources) opener += ` looks like you'll need ${sources}.`;
  const parts = [opener];
  if (due && due.length <= 60) parts.push(`It's due ${due.replace(/^due:?\s*/i, "")}.`);
  const topic = topicLine(req);
  if (topic) parts.push(topic);
  parts.push(opts.pendingAsk ? "Looks good so far." : "This is totally doable. You ready to get rolling?");
  return parts.join(" ").replace(/\s+/g, " ").trim();
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
export function pauPauNextAsk(req: AssignmentRequirements, dismissed: ReadonlySet<PauPauAsk>): PauPauAsk | null {
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
