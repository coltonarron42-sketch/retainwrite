/**
 * Assignment requirements extraction.
 * // SOP: coaching only, never generate submission text
 */

import { dropInvalidEvidence } from "@/lib/assignment/evidence";
import { applyPageWordEstimates } from "@/lib/assignment/pages-to-words";
import { coerceRequirements, requirementsHaveFacts, schemaIssueLog } from "@/lib/assignment/coerce";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import {
  assignmentRequirementsSchema,
  emptyRequirements,
  type AssignmentRequirements,
} from "@/lib/assignment/schema";
import { usableWordCount } from "@/lib/assignment/corpus";
import { grokChatJson, hasGrokKey, MODEL_STRONG } from "@/lib/ai/grok";

const PARSE_SYSTEM = `You extract assignment requirements from teacher materials. The input is an ordered corpus of files and pages, each labeled with file name and page number. Return only the JSON schema. Quote short evidence spans from the text, verbatim, and cite fileId + page in provenance. If a field is not present, value is null and confidence is 0. Never invent due dates, page counts, citation styles, rubric weights, source counts, or URLs. Never write essay text, theses, or outlines. If more than one assignment appears, list candidates; do not pick one. If the text forbids or restricts AI tools, set aiPolicy and quote the line. Include provided readings and links that appear in the materials or the student's URL list; do not invent links.`;

const PARSE_RETRY = `Return one JSON object and nothing else. schemaVersion must be "1.0". Every field is an object with value, confidence (number from 0 to 1), source ("extracted" or "missing"), and confirmed (false). citationStyle.value is "APA 7", "MLA 9", "Chicago 17 Notes", "Chicago 17 Author-Date", "Harvard", "IEEE", "AMA", "other", or null. aiPolicy.value is "unspecified", "allowed", "restricted", or "forbidden". Use null when a detail is absent.`;

export type ModelReader = (input: { system: string; user: string }) => Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; reason: string }
>;

export type ParseResult = {
  requirements: AssignmentRequirements;
  rawText: string;
  parseMeta: {
    model: string;
    fallback: boolean;
    candidates: unknown[];
    usableWords: number;
    reason?: string;
  };
  needsInput: boolean;
  /** Live read failed. Requirements are empty — do not treat them as extracted facts. */
  needsConfirmation: boolean;
};

function liveFailure(rawText: string, words: number, reason: string): ParseResult {
  return {
    requirements: emptyRequirements(),
    rawText,
    parseMeta: {
      model: "none",
      fallback: false,
      candidates: [],
      usableWords: words,
      reason,
    },
    needsInput: true,
    needsConfirmation: true,
  };
}

function publicGrokReason(reason: string): string {
  if (reason === "missing_key") return "missing_key";
  if (/abort|timeout/i.test(reason)) return "timeout";
  return "request_failed";
}

function scrubEvidence(req: AssignmentRequirements, corpus: string): AssignmentRequirements {
  const next = { ...req };
  for (const key of Object.keys(next) as (keyof AssignmentRequirements)[]) {
    const field = next[key];
    if (field && typeof field === "object" && "rawEvidence" in field) {
      // @ts-expect-error indexed
      next[key] = dropInvalidEvidence(field, corpus);
    }
  }
  if (next.length.value) {
    next.length = {
      ...next.length,
      value: applyPageWordEstimates(next.length.value),
    };
  }
  return next;
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function fieldEmpty(field: { value?: unknown } | undefined): boolean {
  const value = field?.value;
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Keep model values, and fill blanks from the rule read of the same text. */
export function fillEmptyRequirements(
  primary: AssignmentRequirements,
  extra: AssignmentRequirements,
): AssignmentRequirements {
  const next = { ...primary };
  const keys = [
    "course",
    "paperType",
    "topic",
    "promptQuestion",
    "length",
    "citationStyle",
    "requiredSources",
    "dueDate",
  ] as const;
  for (const key of keys) {
    if (fieldEmpty(next[key]) && !fieldEmpty(extra[key])) {
      Object.assign(next, { [key]: extra[key] });
    }
  }
  return next;
}

function acceptModelJson(text: string, corpus: string): AssignmentRequirements | null {
  let json: unknown;
  try {
    json = parseModelJson(text);
  } catch {
    console.error("[assignment/parse] schema mismatch", { issues: [{ path: "", code: "invalid_json" }] });
    return null;
  }
  const validated = assignmentRequirementsSchema.safeParse(coerceRequirements(json));
  if (!validated.success) {
    console.error("[assignment/parse] schema mismatch", { issues: schemaIssueLog(validated.error) });
    return null;
  }
  if (!requirementsHaveFacts(validated.data)) return null;
  return scrubEvidence(validated.data, corpus);
}

const defaultModel: ModelReader = ({ system, user }) =>
  grokChatJson({
    model: MODEL_STRONG,
    system,
    user,
    reasoningEffort: "low",
    jsonSchema: {
      name: "assignment_requirements",
      schema: { type: "object", additionalProperties: true },
    },
    timeoutMs: 30_000,
  });

export async function parseAssignmentCorpus(
  corpus: string,
  options?: { mode?: "live" | "demo"; askModel?: ModelReader },
): Promise<ParseResult> {
  const mode = options?.mode ?? "demo";
  const rawText = corpus.trim();
  const words = usableWordCount(rawText);
  const live = mode === "live";
  const allowTopicAndDueDateGuess = live ? false : process.env.NODE_ENV !== "production";

  if (words < 20) {
    if (live) return liveFailure(rawText, words, "too_short");
    return {
      requirements: parseAssignmentFallback("", { allowTopicAndDueDateGuess }),
      rawText,
      parseMeta: {
        model: "none",
        fallback: true,
        candidates: [],
        usableWords: words,
      },
      needsInput: true,
      needsConfirmation: false,
    };
  }

  const ask = options?.askModel ?? (hasGrokKey() ? defaultModel : null);
  let modelReason = ask ? "schema" : "missing_key";
  if (ask) {
    // SOP: coaching only, never generate submission text
    const first = await ask({ system: PARSE_SYSTEM, user: rawText.slice(0, 80_000) });
    if (first.ok) {
      const accepted = acceptModelJson(first.text, rawText);
      if (accepted) {
        const filled = fillEmptyRequirements(
          accepted,
          scrubEvidence(parseAssignmentFallback(rawText, { allowTopicAndDueDateGuess: false }), rawText),
        );
        return {
          requirements: filled,
          rawText,
          parseMeta: { model: first.model, fallback: false, candidates: [], usableWords: words },
          needsInput: false,
          needsConfirmation: false,
        };
      }
      modelReason = "schema";
    } else {
      modelReason = publicGrokReason(first.reason);
    }

    const retry =
      first.ok || modelReason === "schema"
        ? await ask({
            system: `${PARSE_SYSTEM}\n${PARSE_RETRY}`,
            user: rawText.slice(0, 80_000),
          })
        : null;
    if (retry?.ok) {
      const accepted = acceptModelJson(retry.text, rawText);
      if (accepted) {
        const filled = fillEmptyRequirements(
          accepted,
          scrubEvidence(parseAssignmentFallback(rawText, { allowTopicAndDueDateGuess: false }), rawText),
        );
        return {
          requirements: filled,
          rawText,
          parseMeta: { model: retry.model, fallback: false, candidates: [], usableWords: words },
          needsInput: false,
          needsConfirmation: false,
        };
      }
      modelReason = "schema";
    } else if (retry && !retry.ok) {
      modelReason = publicGrokReason(retry.reason);
    }
  }

  const fallback = scrubEvidence(
    parseAssignmentFallback(rawText, { allowTopicAndDueDateGuess }),
    rawText,
  );
  if (live && !requirementsHaveFacts(fallback)) {
    console.info("[assignment/parse] live read failed", { reason: modelReason, facts: 0 });
    return liveFailure(rawText, words, modelReason);
  }
  if (live) {
    console.info("[assignment/parse] used rule fallback", { reason: modelReason });
  }
  return {
    requirements: fallback,
    rawText,
    parseMeta: {
      model: "rule_fallback",
      fallback: true,
      candidates: [],
      usableWords: words,
      ...(live ? { reason: modelReason } : {}),
    },
    needsInput: false,
    needsConfirmation: false,
  };
}
