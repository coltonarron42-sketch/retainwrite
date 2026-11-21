// SOP: coaching only, never generate submission text
// Turn loose model JSON into the assignment schema. Never log the input.

import { z } from "zod";
import {
  emptyRequirements,
  type AssignmentRequirements,
  type CitationStyle,
} from "@/lib/assignment/schema";

const SOURCES = new Set(["extracted", "student_edited", "student_entered", "missing"]);
const METHODS = new Set([
  "pdf_text",
  "docx",
  "txt",
  "ocr_mistral",
  "ocr_grok_vision",
  "paste",
  "fetch",
  "manual",
]);

const CITATION: Record<string, CitationStyle> = {
  apa: "APA 7",
  "apa 7": "APA 7",
  apa7: "APA 7",
  mla: "MLA 9",
  "mla 9": "MLA 9",
  mla9: "MLA 9",
  chicago: "Chicago 17 Author-Date",
  "chicago 17": "Chicago 17 Author-Date",
  "chicago author-date": "Chicago 17 Author-Date",
  "chicago 17 author-date": "Chicago 17 Author-Date",
  "chicago notes": "Chicago 17 Notes",
  "chicago 17 notes": "Chicago 17 Notes",
  harvard: "Harvard",
  ieee: "IEEE",
  ama: "AMA",
  other: "other",
};

const AI_POLICY: Record<string, "unspecified" | "allowed" | "restricted" | "forbidden"> = {
  unspecified: "unspecified",
  unknown: "unspecified",
  none: "unspecified",
  "n/a": "unspecified",
  na: "unspecified",
  allowed: "allowed",
  yes: "allowed",
  restricted: "restricted",
  limited: "restricted",
  forbidden: "forbidden",
  prohibited: "forbidden",
  "not allowed": "forbidden",
};

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Loose;
}

function unwrap(raw: unknown): Loose | null {
  const obj = record(raw);
  if (!obj) return null;
  for (const key of ["requirements", "assignment", "data", "result"]) {
    const inner = record(obj[key]);
    if (inner && ("topic" in inner || "course" in inner || "schemaVersion" in inner || "citationStyle" in inner)) {
      return inner;
    }
  }
  return obj;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function clampConfidence(value: unknown, hasValue: boolean): number {
  const parsed = num(value);
  if (parsed == null) return hasValue ? 0.6 : 0;
  const scaled = parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, scaled));
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0 || value == null) return false;
  return false;
}

function shortString(value: unknown, max = 500): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n|•|;/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => shortString(item, 300))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
}

function lengthValue(value: unknown): unknown {
  if (typeof value === "string") {
    const pages = value.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*pages?/i) ?? value.match(/(\d+)\s*pages?/i);
    const words = value.match(/(\d{2,5})\s*(?:-|–|to)\s*(\d{2,5})\s*words?/i) ?? value.match(/(\d{2,5})\s*words?/i);
    if (words) {
      return {
        wordsMin: Number(words[1]),
        wordsMax: Number(words[2] ?? words[1]),
        raw: value.slice(0, 200),
      };
    }
    if (pages) {
      return {
        pagesMin: Number(pages[1]),
        pagesMax: Number(pages[2] ?? pages[1]),
        raw: value.slice(0, 200),
      };
    }
    return { raw: value.slice(0, 200) };
  }
  const obj = record(value);
  if (!obj) return null;
  const next: Loose = {};
  for (const key of ["pagesMin", "pagesMax", "wordsMin", "wordsMax", "wordsEstimateMin", "wordsEstimateMax"]) {
    const parsed = num(obj[key]);
    if (parsed != null) next[key] = parsed;
  }
  const raw = shortString(obj.raw, 200);
  if (raw) next.raw = raw;
  return Object.keys(next).length ? next : null;
}

function citationValue(value: unknown): CitationStyle | null {
  const text = shortString(value, 80);
  if (!text) return null;
  return CITATION[text.toLowerCase()] ?? null;
}

function policyValue(value: unknown): "unspecified" | "allowed" | "restricted" | "forbidden" | null {
  const text = shortString(value, 40);
  if (!text) return null;
  return AI_POLICY[text.toLowerCase()] ?? null;
}

function readings(value: unknown): unknown[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.slice(0, 20).map((item) => {
    if (typeof item === "string") return { title: item.slice(0, 300) };
    const obj = record(item);
    if (!obj) return {};
    return {
      ...(shortString(obj.title, 300) ? { title: shortString(obj.title, 300) } : {}),
      ...(shortString(obj.url, 500) ? { url: shortString(obj.url, 500) } : {}),
      ...(shortString(obj.notes, 300) ? { notes: shortString(obj.notes, 300) } : {}),
    };
  });
}

function criteria(value: unknown): unknown[] {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 20).map((item) => {
    if (typeof item === "string") return { name: item.slice(0, 200) };
    const obj = record(item);
    if (!obj) return { name: "Criterion" };
    const weight = num(obj.weight);
    return {
      name: shortString(obj.name, 200) ?? "Criterion",
      ...(weight != null ? { weight } : {}),
      ...(shortString(obj.notes, 300) ? { notes: shortString(obj.notes, 300) } : {}),
    };
  });
}

function sources(value: unknown): unknown {
  const obj = record(value);
  if (!obj) {
    const text = shortString(value, 200);
    return text ? { notes: text } : null;
  }
  const count = num(obj.countMin ?? obj.count ?? obj.min);
  return {
    ...(count != null ? { countMin: count } : {}),
    ...(num(obj.countMax) != null ? { countMax: num(obj.countMax) } : {}),
    ...(shortString(obj.types, 200) ? { types: shortString(obj.types, 200) } : {}),
    ...(typeof obj.scholarlyRequired === "boolean" ? { scholarlyRequired: obj.scholarlyRequired } : {}),
    ...(shortString(obj.notes, 300) ? { notes: shortString(obj.notes, 300) } : {}),
  };
}

function provenance(value: unknown): Loose | undefined {
  const obj = record(value);
  if (!obj) return undefined;
  const next: Loose = {};
  const fileId = shortString(obj.fileId, 80);
  const page = num(obj.page);
  const method = shortString(obj.method, 40);
  const excerpt = shortString(obj.excerpt, 500);
  if (fileId) next.fileId = fileId;
  if (page != null && page > 0) next.page = Math.round(page);
  if (method && METHODS.has(method)) next.method = method;
  if (excerpt) next.excerpt = excerpt;
  return Object.keys(next).length ? next : undefined;
}

function field(value: unknown, coerceValue: (input: unknown) => unknown): Loose {
  if (value == null) return { value: null, confidence: 0, source: "missing", confirmed: false };
  const obj = record(value);
  const looksLikeField = Boolean(obj && ("value" in obj || "confidence" in obj || "source" in obj));
  const rawValue = looksLikeField ? obj?.value : value;
  const coerced = coerceValue(rawValue);
  const hasValue =
    coerced != null && !(Array.isArray(coerced) && coerced.length === 0) && coerced !== "";
  const sourceText = looksLikeField ? shortString(obj?.source, 40)?.toLowerCase() : null;
  const source = sourceText && SOURCES.has(sourceText) ? sourceText : hasValue ? "extracted" : "missing";
  const evidence = looksLikeField ? shortString(obj?.rawEvidence, 500) : null;
  const next: Loose = {
    value: coerced,
    confidence: clampConfidence(looksLikeField ? obj?.confidence : undefined, hasValue),
    source,
    confirmed: booleanValue(looksLikeField ? obj?.confirmed : false),
  };
  if (evidence) next.rawEvidence = evidence;
  const where = looksLikeField ? provenance(obj?.provenance) : undefined;
  if (where) next.provenance = where;
  return next;
}

const VALUE_COERCERS: Record<string, (value: unknown) => unknown> = {
  course: (value) => shortString(value, 120),
  paperType: (value) => shortString(value, 120),
  topic: (value) => shortString(value, 400),
  promptQuestion: (value) => shortString(value, 600),
  length: lengthValue,
  citationStyle: citationValue,
  formattingRules: stringList,
  requiredSources: sources,
  providedReadings: readings,
  providedSources: readings,
  structuralRequirements: stringList,
  dueDate: (value) => shortString(value, 40),
  rubricCriteria: criteria,
  otherInstructions: (value) => shortString(value, 1000),
  aiPolicy: policyValue,
  language: (value) => shortString(value, 40),
};

/** Paths and codes only. Zod messages can echo the model payload. */
export function schemaIssueLog(error: z.ZodError): { path: string; code: string }[] {
  return error.issues.slice(0, 12).map((issue) => ({
    path: issue.path.map((part) => String(part)).join(".").slice(0, 80),
    code: issue.code,
  }));
}

export function coerceRequirements(raw: unknown): unknown {
  const obj = unwrap(raw);
  if (!obj) return raw;
  const base = emptyRequirements() as unknown as Loose;
  base.schemaVersion = "1.0";
  for (const [key, coerceValue] of Object.entries(VALUE_COERCERS)) {
    if (key in obj) base[key] = field(obj[key], coerceValue);
  }
  const other = shortString(obj.citationStyleOther, 80);
  if (other) base.citationStyleOther = other;
  return base;
}

export function requirementsHaveFacts(requirements: AssignmentRequirements): boolean {
  const keys = [
    "course",
    "paperType",
    "topic",
    "promptQuestion",
    "length",
    "citationStyle",
    "requiredSources",
    "providedReadings",
    "structuralRequirements",
    "dueDate",
    "rubricCriteria",
    "otherInstructions",
    "formattingRules",
  ] as const;
  return keys.some((key) => {
    const fieldValue = requirements[key];
    if (!fieldValue || typeof fieldValue !== "object" || !("value" in fieldValue)) return false;
    const value = fieldValue.value;
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  });
}
