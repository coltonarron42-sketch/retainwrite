/**
 * Assignment requirements extraction.
 * // SOP: coaching only, never generate submission text
 */

import { groundToDescription } from "@/lib/assignment/ground-described";
import { plausibleTopic } from "@/lib/assignment/plausible";
import { dropInvalidEvidence } from "@/lib/assignment/evidence";
import { applyPageWordEstimates } from "@/lib/assignment/pages-to-words";
import { coerceRequirements, requirementsHaveFacts, schemaIssueLog } from "@/lib/assignment/coerce";
import { isPlaceholderTopic, parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import {
  assignmentRequirementsSchema,
  emptyRequirements,
  type AssignmentRequirements,
} from "@/lib/assignment/schema";
import { usableWordCount } from "@/lib/assignment/corpus";
import { grokChatJson, hasGrokKey, MODEL_FAST, MODEL_STRONG } from "@/lib/ai/grok";
import { FLAT_ASSIGNMENT_SCHEMA, FLAT_PARSE_SYSTEM, flatToNested, looksFlat } from "@/lib/assignment/flat-parse";

const PARSE_SYSTEM = `You extract assignment requirements from teacher materials. The input is an ordered corpus of files and pages, each labeled with file name and page number. Return only one JSON object. Quote short evidence spans from the text, verbatim, and cite fileId + page in provenance. If a field is not present, value is null and confidence is 0. Never invent due dates, page counts, citation styles, rubric weights, source counts, or URLs. Never write essay text, theses, or outlines. Topic is the subject the student must address, never a length, spacing, or citation-format line. promptQuestion is the assignment's actual question. If the text forbids or restricts AI tools, set aiPolicy and quote the line. Include provided readings and links that appear in the materials or the student's URL list; do not invent links.`;

/** One model read, then the rule parser. Two 30s calls were blowing past 15s. */
/** A described assignment ("5 page MLA essay on teen sleep, due Friday") is short. */
export const DESCRIBED_MIN_WORDS = 4;
export const PARSE_TIMEOUT_MS = 12_000;

/** Length and format instructions are not a topic or a prompt question. */
export function isFormatOrLengthLine(value: string | null | undefined): boolean {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return false;
  if (/^\(?\d{3,5}\s*words?\)?/i.test(text)) return true;
  const hits = text.match(/\b(words?|pages?|double|spaced|mla|apa|chicago|format|spacing|font|margin)\b/gi) ?? [];
  if (hits.length < 2) return false;
  return !/\b(how|why|should|affect|social|health|argue|explain|discuss)\b/i.test(text);
}

export type ModelReader = (input: { system: string; user: string; timeoutMs?: number; strong?: boolean }) => Promise<
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
  for (const key of keys) {
    if (fieldEmpty(next[key]) && !fieldEmpty(extra[key])) {
      Object.assign(next, { [key]: extra[key] });
    }
  }
  return next;
}

/** Drop a format line stored as the topic, then fill the real prompt from the rules. */
export function sanitizeParsedRequirements(
  primary: AssignmentRequirements,
  extra: AssignmentRequirements,
): AssignmentRequirements {
  const next = { ...primary };
  if (
    typeof next.topic.value === "string" &&
    (isFormatOrLengthLine(next.topic.value) || isPlaceholderTopic(next.topic.value))
  ) {
    next.topic = emptyRequirements().topic;
  }
  if (
    typeof next.promptQuestion.value === "string" &&
    isFormatOrLengthLine(next.promptQuestion.value)
  ) {
    next.promptQuestion = emptyRequirements().promptQuestion;
  }
  // "other" with nothing named is not a style: it dead-ends the confirm gate
  // ("Describe the other citation style"). Let the sheet's own words fill it.
  if (next.citationStyle.value === "other" && !next.citationStyleOther?.trim()) {
    next.citationStyle = emptyRequirements().citationStyle;
  }
  const filled = fillEmptyRequirements(next, extra);
  if (typeof filled.topic.value === "string" && isFormatOrLengthLine(filled.topic.value)) {
    filled.topic = emptyRequirements().topic;
  }
  return filled;
}

function acceptModelJson(text: string, corpus: string): AssignmentRequirements | null {
  let json: unknown;
  try {
    json = parseModelJson(text);
  } catch {
    console.error("[assignment/parse] schema mismatch", { issues: [{ path: "", code: "invalid_json" }] });
    return null;
  }
  const validated = assignmentRequirementsSchema.safeParse(
    coerceRequirements(looksFlat(json) ? flatToNested(json) : json),
  );
  if (!validated.success) {
    console.error("[assignment/parse] schema mismatch", { issues: schemaIssueLog(validated.error) });
    return null;
  }
  if (!requirementsHaveFacts(validated.data)) return null;
  return scrubEvidence(validated.data, corpus);
}

/**
 * The fast model with no reasoning and a flat named schema: the strong model
 * took 7-12s (and fell back to the rule parser on a timeout, which loses the
 * rubric and named sources). This is a copy-the-facts task, not reasoning.
 */
const defaultModel: ModelReader = ({ user, timeoutMs, strong }) =>
  grokChatJson({
    // The last retry goes to the strong model: when the fast model is out of
    // capacity (xAI 429s during QA's runs), the strong pool usually is not.
    model: strong ? MODEL_STRONG : MODEL_FAST,
    system: FLAT_PARSE_SYSTEM,
    user,
    reasoningEffort: strong ? "low" : "none",
    jsonSchema: {
      name: "assignment_requirements",
      schema: FLAT_ASSIGNMENT_SCHEMA as unknown as Record<string, unknown>,
    },
    timeoutMs: timeoutMs ?? PARSE_TIMEOUT_MS,
  });

/**
 * Rule-read facts are guesses unless they came off a labeled line ("Length:",
 * "Topic"), which the rules mark 0.8+. Everything else drops below the 0.6 bar
 * Pau Pau uses to say a fact back, so it asks instead of stating it.
 */
export function capFallbackConfidence(req: AssignmentRequirements): AssignmentRequirements {
  const next = { ...req } as Record<string, unknown>;
  for (const [key, field] of Object.entries(req)) {
    if (!field || typeof field !== "object" || !("confidence" in field)) continue;
    const f = field as { confidence: number; value: unknown };
    if (f.value == null) continue;
    let confidence = f.confidence < 0.8 ? Math.min(f.confidence, 0.5) : f.confidence;
    if (key === "topic" && typeof f.value === "string" && !plausibleTopic(f.value)) confidence = 0;
    next[key] = { ...f, confidence };
  }
  return next as AssignmentRequirements;
}

/**
 * The model read is the only trustworthy one, so don't give up on it after a
 * single try. One request starts at once; a second starts if the first fails
 * or hasn't answered within HEDGE_AFTER_MS (slow queueing, not a slow task);
 * a third if both fail early. First accepted answer wins; overall deadline
 * PARSE_DEADLINE_MS.
 */
// Normal fast-model reads take 3-6.5s (measured Nov 22); hedge only past that, so a
// healthy read is not paid for twice.
export const HEDGE_AFTER_MS = 8_000;
export const PARSE_DEADLINE_MS = 22_000;
export const RETRY_BACKOFF_MS = 700;

async function askReliably(
  ask: ModelReader,
  rawText: string,
): Promise<{ ok: true; requirements: AssignmentRequirements; model: string } | { ok: false; reason: string }> {
  const started = Date.now();
  const user = rawText.slice(0, 80_000);
  return new Promise((resolve) => {
    let settled = false;
    let launched = 0;
    let finished = 0;
    let lastReason = "request_failed";
    const timers: ReturnType<typeof setTimeout>[] = [];
    const done = (value: Awaited<ReturnType<typeof askReliably>>) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      resolve(value);
    };
    const launch = () => {
      if (settled || launched >= 3) return;
      const remaining = PARSE_DEADLINE_MS - (Date.now() - started);
      if (remaining < 4_000) return;
      launched++;
      const attempt = launched;
      void ask({
        system: PARSE_SYSTEM,
        user,
        timeoutMs: Math.min(PARSE_TIMEOUT_MS + 4_000, remaining),
        ...(attempt === 3 ? { strong: true } : {}),
      })
        .then((res) => {
          finished++;
          if (res.ok) {
            const accepted = acceptModelJson(res.text, rawText);
            if (accepted) {
              console.info("[assignment/parse] model read", { attempt, ms: Date.now() - started });
              done({ ok: true, requirements: accepted, model: res.model });
              return;
            }
            lastReason = "schema";
          } else {
            lastReason = publicGrokReason(res.reason);
          }
          console.warn("[assignment/parse] attempt failed", { attempt, reason: lastReason, ms: Date.now() - started });
          if (lastReason === "missing_key") return done({ ok: false, reason: lastReason });
          // A capacity error comes back in ~3s; retrying that same instant
          // mostly gets another one, so wait a beat.
          if (launched < 3) timers.push(setTimeout(launch, RETRY_BACKOFF_MS));
          else if (finished >= launched) done({ ok: false, reason: lastReason });
        })
        .catch(() => {
          finished++;
          if (launched < 3) launch();
          else if (finished >= launched) done({ ok: false, reason: lastReason });
        });
    };
    launch();
    timers.push(setTimeout(launch, HEDGE_AFTER_MS));
    timers.push(setTimeout(() => done({ ok: false, reason: "timeout" }), PARSE_DEADLINE_MS));
  });
}

export async function parseAssignmentCorpus(
  corpus: string,
  options?: {
    mode?: "live" | "demo";
    askModel?: ModelReader;
    minWords?: number;
    /** The student's own typed description: keep only facts they actually gave. */
    described?: boolean;
  },
): Promise<ParseResult> {
  const mode = options?.mode ?? "demo";
  const rawText = corpus.trim();
  const words = usableWordCount(rawText);
  const live = mode === "live";
  const allowTopicAndDueDateGuess = live ? false : process.env.NODE_ENV !== "production";

  if (words < (options?.minWords ?? 20)) {
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
    const read = await askReliably(ask, rawText);
    if (read.ok) {
      const filled = sanitizeParsedRequirements(
        read.requirements,
        scrubEvidence(parseAssignmentFallback(rawText, { allowTopicAndDueDateGuess: false }), rawText),
      );
      return {
        requirements: options?.described ? groundToDescription(filled, rawText) : filled,
        rawText,
        parseMeta: { model: read.model, fallback: false, candidates: [], usableWords: words },
        needsInput: false,
        needsConfirmation: false,
      };
    }
    modelReason = read.reason;
  }

  const fallback = sanitizeParsedRequirements(
    scrubEvidence(parseAssignmentFallback(rawText, { allowTopicAndDueDateGuess }), rawText),
    scrubEvidence(parseAssignmentFallback(rawText, { allowTopicAndDueDateGuess: false }), rawText),
  );
  if (live && !requirementsHaveFacts(fallback)) {
    console.info("[assignment/parse] live read failed", { reason: modelReason, facts: 0 });
    return liveFailure(rawText, words, modelReason);
  }
  if (live) {
    console.info("[assignment/parse] used rule fallback", { reason: modelReason });
  }
  const grounded = options?.described ? groundToDescription(fallback, rawText) : fallback;
  return {
    requirements: live ? capFallbackConfidence(grounded) : grounded,
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
