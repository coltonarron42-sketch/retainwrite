/**
 * A typed description ("a 5 page APA paper on teen sleep, due Friday") is the
 * student's own words, so Pau Pau may say back only what they actually said.
 * The model tends to fill gaps ("research paper", "at least four sources");
 * this drops any fact the description doesn't support. Uploaded sheets are
 * not touched.
 */
import { emptyField, type AssignmentRequirements, type Field } from "@/lib/assignment/schema";

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100,
};
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const STOP = new Set(
  "the a an and or of to in on for with about at by from is are be it this that your you my our their should would will must need needs paper essay write writing use using least more than".split(" "),
);

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/, "");
}
function tokens(text: string): string[] {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(Boolean);
}
function contentStems(text: string): string[] {
  return tokens(text).filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)).map(stem);
}

export type Description = { stems: Set<string>; numbers: Set<number>; raw: string };

export function describe(text: string): Description {
  const raw = text.toLowerCase();
  const numbers = new Set<number>();
  for (const m of raw.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+/g)) numbers.add(Number(m[0]));
  for (const t of tokens(raw)) if (NUMBER_WORDS[t] != null) numbers.add(NUMBER_WORDS[t]!);
  return { stems: new Set(tokens(raw).map(stem)), numbers, raw };
}

/** Share of the value's content words the student actually used (1 when it has none). */
export function overlap(value: string, d: Description): number {
  const words = contentStems(value);
  if (!words.length) return 1;
  return words.filter((w) => d.stems.has(w)).length / words.length;
}

function supported(value: string | null | undefined, d: Description, min = 0.6): boolean {
  return Boolean(value && value.trim()) && overlap(value!, d) >= min;
}

function drop<T>(field: Field<T>, empty: T | null = null): Field<T> {
  return emptyField<T>(empty);
}

const PAPER_NOUNS = /(essay|paper|report|reflection|analysis|review|memo|proposal|narrative|response|letter|speech|story|summary|journal)/i;
const STYLES: Array<[RegExp, RegExp]> = [
  [/^apa/i, /\bapa\b/],
  [/^mla/i, /\bmla\b/],
  [/^chicago/i, /\b(chicago|turabian)\b/],
  [/^harvard/i, /\bharvard\b/],
  [/^ieee/i, /\bieee\b/],
  [/^ama/i, /\bama\b/],
];

function dueSupported(value: string, d: Description): boolean {
  const v = value.toLowerCase();
  if (/\b(today|tomorrow|tonight|next week)\b/.test(v)) return /\b(today|tomorrow|tonight|next week)\b/.test(d.raw);
  const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  const month = iso ? MONTHS[Number(iso[2]) - 1] : MONTHS.find((m) => v.includes(m) || v.includes(m.slice(0, 3)));
  const day = iso ? Number(iso[3]) : Number(v.replace(/\b(19|20)\d{2}\b/g, "").match(/\b(\d{1,2})\b/)?.[1] ?? NaN);
  const weekday = WEEKDAYS.find((w) => v.includes(w));
  if (weekday) return d.raw.includes(weekday) || d.raw.includes(weekday.slice(0, 3));
  const monthOk = !month || d.raw.includes(month) || d.raw.includes(month.slice(0, 3)) || (iso ? d.raw.includes(`${Number(iso[2])}/`) : false);
  const dayOk = Number.isNaN(day) || d.numbers.has(day);
  return Boolean(month || !Number.isNaN(day)) && monthOk && dayOk;
}

export function groundToDescription(req: AssignmentRequirements, text: string): AssignmentRequirements {
  const d = describe(text);
  const out: AssignmentRequirements = { ...req };

  // Paper type: keep only the words the student used ("paper", not "research paper").
  const type = req.paperType.value?.trim();
  if (type) {
    if (!supported(type, d, 1)) {
      // The student's own word for it ("essay"), if they used one; otherwise nothing.
      const said = d.raw.match(PAPER_NOUNS)?.[1]?.toLowerCase();
      out.paperType = said ? { ...req.paperType, value: said } : drop(req.paperType);
    }
  }

  // Length: every number and its unit must be in the description.
  const len = req.length.value;
  if (len) {
    const nums = [len.pagesMin, len.pagesMax, len.wordsMin, len.wordsMax].filter((n): n is number => typeof n === "number");
    const unitOk =
      (len.pagesMin == null && len.pagesMax == null) || /\b(pages?|pp?g?s?)\b/.test(d.raw);
    const wordUnitOk = (len.wordsMin == null && len.wordsMax == null) || /\bwords?\b/.test(d.raw);
    if (!nums.length || !nums.every((n) => d.numbers.has(n)) || !unitOk || !wordUnitOk) out.length = drop(req.length);
  }

  // Citation style must be named.
  const style = req.citationStyle.value;
  if (style) {
    const rule = STYLES.find(([name]) => name.test(style));
    const ok = rule ? rule[1].test(d.raw) : supported(req.citationStyleOther ?? "", d, 1);
    if (!ok) out.citationStyle = drop(req.citationStyle);
  }

  // Sources: counts and "scholarly" only when said.
  const src = req.requiredSources.value;
  if (src) {
    const next = { ...src };
    if (next.countMin != null && !d.numbers.has(next.countMin)) delete next.countMin;
    if (next.countMax != null && !d.numbers.has(next.countMax)) delete next.countMax;
    if (next.scholarlyRequired && !/\b(scholarly|peer|academic|journal)/.test(d.raw)) delete next.scholarlyRequired;
    if (next.types && !supported(next.types, d)) delete next.types;
    if (next.notes && !supported(next.notes, d)) delete next.notes;
    if (!next.types && /\bpeer[\s-]?reviewed\b/.test(d.raw)) next.types = "peer-reviewed sources";
    const left = next.countMin != null || next.countMax != null || next.scholarlyRequired || next.types || next.notes;
    out.requiredSources = left ? { ...req.requiredSources, value: next } : drop(req.requiredSources);
  }

  for (const key of ["course", "instructor", "otherInstructions"] as const) {
    const field = req[key] as Field<string> | undefined;
    if (field?.value && !supported(field.value, d, key === "otherInstructions" ? 0.5 : 0.75)) {
      (out as Record<string, unknown>)[key] = drop(field);
    }
  }
  for (const key of ["topic", "promptQuestion"] as const) {
    if (req[key].value && !supported(req[key].value, d, 0.5)) out[key] = drop(req[key]);
  }
  if (req.dueDate.value && !dueSupported(req.dueDate.value, d)) out.dueDate = drop(req.dueDate);

  for (const key of ["structuralRequirements", "formattingRules"] as const) {
    const items = req[key].value ?? [];
    const kept = items.filter((item) => supported(item, d));
    if (kept.length !== items.length) out[key] = kept.length ? { ...req[key], value: kept } : drop(req[key], []);
  }
  const rubric = req.rubricCriteria.value ?? [];
  const keptRubric = rubric.filter((c) => supported(c.name, d));
  if (keptRubric.length !== rubric.length) {
    out.rubricCriteria = keptRubric.length ? { ...req.rubricCriteria, value: keptRubric } : drop(req.rubricCriteria, []);
  }
  return out;
}
