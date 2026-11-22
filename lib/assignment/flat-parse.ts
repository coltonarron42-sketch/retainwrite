/**
 * The assignment read asks the model for one flat, named JSON object.
 * The old request sent an open schema with no field names, so the model guessed
 * keys and spent its time writing evidence/provenance wrappers for every field;
 * the rubric, named sources and instructor were often lost. The flat shape is
 * short to generate and maps onto the card fields here.
 * // SOP: coaching only, never generate submission text
 */

const str = { type: ["string", "null"] } as const;
const num = { type: ["number", "null"] } as const;
const strList = { type: "array", items: { type: "string" } } as const;

export const FLAT_CITATION_STYLES = [
  "APA 7",
  "MLA 9",
  "Chicago 17 Notes",
  "Chicago 17 Author-Date",
  "Harvard",
  "IEEE",
  "AMA",
  "other",
] as const;

export const FLAT_ASSIGNMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "course",
    "instructor",
    "paperType",
    "topic",
    "promptQuestion",
    "lengthText",
    "wordsMin",
    "wordsMax",
    "pagesMin",
    "pagesMax",
    "citationStyle",
    "formattingRules",
    "sourcesCountMin",
    "sourceTypes",
    "specificRequiredSources",
    "providedReadings",
    "structuralRequirements",
    "dueDate",
    "rubricCriteria",
    "otherInstructions",
    "aiPolicy",
    "evidence",
  ],
  properties: {
    course: str,
    instructor: str,
    paperType: str,
    topic: str,
    promptQuestion: str,
    lengthText: str,
    wordsMin: num,
    wordsMax: num,
    pagesMin: num,
    pagesMax: num,
    citationStyle: { type: ["string", "null"], enum: [...FLAT_CITATION_STYLES, null] },
    formattingRules: strList,
    sourcesCountMin: num,
    sourceTypes: str,
    specificRequiredSources: strList,
    providedReadings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: { title: str, url: str },
      },
    },
    structuralRequirements: strList,
    dueDate: str,
    rubricCriteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "weight", "description"],
        properties: { name: { type: "string" }, weight: num, description: str },
      },
    },
    otherInstructions: str,
    aiPolicy: { type: "string", enum: ["unspecified", "allowed", "restricted", "forbidden"] },
    evidence: {
      type: "object",
      additionalProperties: false,
      required: ["topic", "length", "citationStyle", "dueDate", "instructor"],
      properties: { topic: str, length: str, citationStyle: str, dueDate: str, instructor: str },
    },
  },
} as const;

export const FLAT_PARSE_SYSTEM = `You read teacher assignment materials and fill one JSON object that matches the schema. Copy facts from the text; never invent them. Use null (or []) when the text does not say. Never write essay text, theses or outlines.
Fields:
- course: course name/code as written (e.g. "ENG 102 – Composition II"). Never a date.
- instructor: the teacher/professor's name as written (e.g. "Dr. Maria Lopez"), or null.
- paperType: e.g. argumentative essay, research paper, reflection.
- topic: the subject the student must write about, in the text's words. Never a length, spacing or citation line.
- promptQuestion: the assignment's actual question, verbatim if there is one.
- lengthText: the length line verbatim (e.g. "1,200–1,500 words"); wordsMin/wordsMax/pagesMin/pagesMax as numbers from it (strip commas).
- citationStyle: one of the enum values (MLA = "MLA 9", APA = "APA 7").
- formattingRules: every formatting instruction, one per item (font, size, spacing, margins, header/heading, page numbers, title, file type, works cited page).
- sourcesCountMin and sourceTypes: the source requirement (e.g. 3, "scholarly sources, one peer-reviewed").
- specificRequiredSources: each named source the student must use, as written (e.g. "American Academy of Pediatrics (2014) policy statement on school start times").
- providedReadings: readings or links supplied in the materials.
- structuralRequirements: required parts/sections (e.g. counterargument paragraph, thesis in the introduction).
- dueDate: as written.
- rubricCriteria: every criterion of the rubric or grading table, even under a heading like "Grading" or "How you'll be graded"; weight as a number (points or percent) when shown; description = the short criterion text.
- otherInstructions: any remaining instructions (submission, drafts, peer review), short.
- aiPolicy: forbidden/restricted/allowed if the text addresses AI tools, else unspecified.
- evidence: short verbatim quotes (under 120 characters) for topic, length, citationStyle, dueDate and instructor, or null.`;

type Flat = Record<string, unknown>;

function s(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function n(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value.replace(/,/g, "")))) {
    return Number(value.replace(/,/g, ""));
  }
  return null;
}
function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(s).filter((item): item is string => Boolean(item)) : [];
}

/** Flat answers carry keys the nested card format never has. */
export function looksFlat(json: unknown): json is Flat {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const obj = json as Flat;
  return "lengthText" in obj || "specificRequiredSources" in obj || "sourcesCountMin" in obj;
}

function field(value: unknown, evidence?: unknown): Flat | null {
  const empty =
    value == null ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);
  if (empty) return null;
  const quote = s(evidence);
  return { value, confidence: 0.8, source: "extracted", confirmed: false, ...(quote ? { rawEvidence: quote } : {}) };
}

/** Map the flat answer into the nested field format coerceRequirements reads. */
export function flatToNested(flat: Flat): Flat {
  const evidence = (flat.evidence && typeof flat.evidence === "object" ? flat.evidence : {}) as Flat;
  const length: Flat = {};
  for (const key of ["wordsMin", "wordsMax", "pagesMin", "pagesMax"]) {
    const value = n(flat[key]);
    if (value != null && value > 0) length[key] = value;
  }
  if (length.wordsMin != null && length.wordsMax == null) length.wordsMax = length.wordsMin;
  if (length.pagesMin != null && length.pagesMax == null) length.pagesMax = length.pagesMin;
  const lengthText = s(flat.lengthText);
  if (lengthText) length.raw = lengthText.slice(0, 200);

  const named = list(flat.specificRequiredSources);
  const count = n(flat.sourcesCountMin);
  const types = s(flat.sourceTypes);
  const sources: Flat = {};
  if (count != null && count > 0) sources.countMin = count;
  const typesLine = [count != null && count > 0 && types && !/\d/.test(types) ? `At least ${count} ${types}` : types]
    .filter(Boolean)
    .join("");
  if (typesLine) sources.types = typesLine;
  if (named.length) sources.notes = `Must include: ${named.join("; ")}`;

  const rubric = Array.isArray(flat.rubricCriteria)
    ? (flat.rubricCriteria as unknown[])
        .map((item) => (item && typeof item === "object" ? (item as Flat) : null))
        .filter((item): item is Flat => Boolean(item && s(item.name)))
        .map((item) => {
          const weight = n(item.weight);
          const description = s(item.description);
          return {
            name: s(item.name) as string,
            ...(weight != null ? { weight } : {}),
            ...(description ? { notes: description } : {}),
          };
        })
    : [];
  const readings = Array.isArray(flat.providedReadings)
    ? (flat.providedReadings as unknown[])
        .map((item) => (item && typeof item === "object" ? (item as Flat) : null))
        .filter((item): item is Flat => Boolean(item && (s(item.title) || s(item.url))))
        .map((item) => ({
          ...(s(item.title) ? { title: s(item.title) } : {}),
          ...(s(item.url) ? { url: s(item.url) } : {}),
        }))
    : [];

  const nested: Flat = {
    course: field(s(flat.course)),
    instructor: field(s(flat.instructor), evidence.instructor),
    paperType: field(s(flat.paperType)),
    topic: field(s(flat.topic), evidence.topic),
    promptQuestion: field(s(flat.promptQuestion)),
    length: field(length, evidence.length),
    citationStyle: field(s(flat.citationStyle), evidence.citationStyle),
    formattingRules: field(list(flat.formattingRules)),
    requiredSources: field(sources),
    providedReadings: field(readings),
    structuralRequirements: field(list(flat.structuralRequirements)),
    dueDate: field(s(flat.dueDate), evidence.dueDate),
    rubricCriteria: field(rubric),
    otherInstructions: field(s(flat.otherInstructions)),
    aiPolicy: field(s(flat.aiPolicy) ?? "unspecified"),
  };
  for (const key of Object.keys(nested)) if (nested[key] == null) delete nested[key];
  return nested;
}
