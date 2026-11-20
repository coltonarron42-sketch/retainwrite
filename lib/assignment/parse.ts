/**
 * Assignment requirements extraction.
 * // SOP: coaching only, never generate submission text
 */

import { dropInvalidEvidence } from "@/lib/assignment/evidence";
import { applyPageWordEstimates } from "@/lib/assignment/pages-to-words";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import {
  assignmentRequirementsSchema,
  type AssignmentRequirements,
} from "@/lib/assignment/schema";
import { usableWordCount } from "@/lib/assignment/corpus";
import { grokChatJson, hasGrokKey, MODEL_STRONG } from "@/lib/ai/grok";

const PARSE_SYSTEM = `You extract assignment requirements from teacher materials. The input is an ordered corpus of files and pages, each labeled with file name and page number. Return only the JSON schema. Quote short evidence spans from the text, verbatim, and cite fileId + page in provenance. If a field is not present, value is null and confidence is 0. Never invent due dates, page counts, citation styles, rubric weights, source counts, or URLs. Never write essay text, theses, or outlines. If more than one assignment appears, list candidates; do not pick one. If the text forbids or restricts AI tools, set aiPolicy and quote the line. Include provided readings and links that appear in the materials or the student's URL list; do not invent links.`;

export type ParseResult = {
  requirements: AssignmentRequirements;
  rawText: string;
  parseMeta: {
    model: string;
    fallback: boolean;
    candidates: unknown[];
    usableWords: number;
  };
  needsInput: boolean;
};

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

export async function parseAssignmentCorpus(corpus: string): Promise<ParseResult> {
  const rawText = corpus.trim();
  const words = usableWordCount(rawText);

  if (words < 20) {
    return {
      requirements: parseAssignmentFallback(""),
      rawText,
      parseMeta: {
        model: "none",
        fallback: true,
        candidates: [],
        usableWords: words,
      },
      needsInput: true,
    };
  }

  if (hasGrokKey()) {
    // // SOP: coaching only, never generate submission text
    const result = await grokChatJson({
      model: MODEL_STRONG,
      system: PARSE_SYSTEM,
      user: rawText.slice(0, 80_000),
      reasoningEffort: "low",
      jsonSchema: {
        name: "assignment_requirements",
        schema: {
          type: "object",
          additionalProperties: true,
        },
      },
      timeoutMs: 30_000,
    });

    if (result.ok) {
      try {
        const parsed = JSON.parse(result.text);
        const validated = assignmentRequirementsSchema.safeParse(parsed);
        if (validated.success) {
          return {
            requirements: scrubEvidence(validated.data, rawText),
            rawText,
            parseMeta: {
              model: result.model,
              fallback: false,
              candidates: [],
              usableWords: words,
            },
            needsInput: false,
          };
        }
      } catch {
        /* fall through */
      }
    }
  }

  const fallback = scrubEvidence(parseAssignmentFallback(rawText), rawText);
  return {
    requirements: fallback,
    rawText,
    parseMeta: {
      model: "rule_fallback",
      fallback: true,
      candidates: [],
      usableWords: words,
    },
    needsInput: false,
  };
}
