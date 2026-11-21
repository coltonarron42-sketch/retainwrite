// SOP: coaching only, never generate submission text

import { z } from "zod";
import { isVerbatimSubstring } from "@/lib/coaching/lesson";
import { isThinAnswer } from "@/lib/coaching/thin";
import { wordCount } from "@/lib/utils";

export const LOGIC_OPENER = "I want to do a logic check. Do you feel good about this?";
export const LOGIC_YES = "Yes, check it";
export const LOGIC_TWEAK = "Let me tweak it first";
export const LOGIC_PASS = "Logic check ✓ Looks solid.";
export const LOGIC_ALERT_LABEL = "Logic alert";
export const LOGIC_STRONG_HEADLINE = "We would not recommend moving forward.";
export const LOGIC_STRONG_DETAIL = "This claim doesn't hold up as written.";
export const LOGIC_MODERATE_TITLE = "A thought before you move on";
export const LOGIC_WRITER = "Your call. You're the writer.";
export const LOGIC_CONTINUE = "Continue anyway";

export const logicCheckSchema = z.object({
  tier: z.enum(["pass", "moderate", "strong"]),
  basis: z.enum([
    "none",
    "debatable_interpretation",
    "weak_support",
    "defies_logic",
    "contradicts_assignment",
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(240),
  citedTerm: z
    .object({
      rubricRef: z.string(),
      quote: z.string().max(200),
    })
    .nullable(),
  studentClaimRef: z
    .object({
      ideaId: z.string(),
      quote: z.string().max(160),
    })
    .nullable(),
  logicFailure: z.string().max(160).nullable(),
  alternativeAngles: z
    .array(
      z.object({
        question: z.string().max(160),
        rubricRef: z.string(),
      }),
    )
    .max(3),
  reframeAvailable: z.boolean(),
});

export type LogicCheckResult = z.infer<typeof logicCheckSchema>;

export type FinalizedLogic = {
  result: LogicCheckResult;
  downgradedFrom: LogicCheckResult["tier"] | null;
  failedOpen: boolean;
  memoryClamped: boolean;
  blocks: false;
};

const COUNTER = /counter-?argument|rebuttal/i;

export function suggestsCounterargument(result: LogicCheckResult): boolean {
  if (COUNTER.test(result.reason)) return true;
  return result.alternativeAngles.some((angle) => COUNTER.test(angle.question));
}

export function logicChoice(choice: string): { advances: boolean; blocks: false } {
  if (choice === "tweak" || choice === "adjust" || choice === "revise" || choice === "reframe" || choice === "new_angle") {
    return { advances: false, blocks: false };
  }
  return { advances: true, blocks: false };
}

function passResult(): LogicCheckResult {
  return {
    tier: "pass",
    basis: "none",
    confidence: 1,
    reason: "",
    citedTerm: null,
    studentClaimRef: null,
    logicFailure: null,
    alternativeAngles: [],
    reframeAvailable: false,
  };
}

function stripCounterargument(result: LogicCheckResult, required: boolean): LogicCheckResult {
  if (required) return result;
  return {
    ...result,
    reason: COUNTER.test(result.reason) ? "" : result.reason,
    alternativeAngles: result.alternativeAngles.filter((angle) => !COUNTER.test(angle.question)),
  };
}

export function finalizeLogicCheck(
  raw: LogicCheckResult | null,
  ctx: {
    assignmentText: string;
    studentNotes: string;
    mode: "lesson" | "memory";
    rubricRequiresCounterargument: boolean;
    validRubricRefs: string[];
    error?: boolean;
  },
): FinalizedLogic {
  if (ctx.error || !raw) {
    return {
      result: passResult(),
      downgradedFrom: raw?.tier ?? null,
      failedOpen: true,
      memoryClamped: false,
      blocks: false,
    };
  }

  let result = stripCounterargument(raw, ctx.rubricRequiresCounterargument);
  let downgradedFrom: LogicCheckResult["tier"] | null = null;
  let memoryClamped = false;

  if (ctx.mode === "memory" && result.tier === "strong") {
    result = { ...result, tier: "moderate" };
    memoryClamped = true;
    downgradedFrom = "strong";
  }

  if (result.tier === "strong") {
    const opinionOnly =
      result.basis === "none" || result.basis === "debatable_interpretation";
    const assignmentHit =
      result.basis === "contradicts_assignment" &&
      Boolean(result.citedTerm) &&
      isVerbatimSubstring(result.citedTerm!.quote, ctx.assignmentText);
    const logicHit =
      result.basis === "defies_logic" &&
      Boolean(result.logicFailure?.trim()) &&
      Boolean(result.studentClaimRef) &&
      isVerbatimSubstring(result.studentClaimRef!.quote, ctx.studentNotes);
    const keep = result.confidence >= 0.8 && !opinionOnly && (assignmentHit || logicHit);
    if (!keep) {
      downgradedFrom = downgradedFrom ?? "strong";
      result = { ...result, tier: "moderate" };
    }
  }

  if (result.tier === "moderate") {
    const ref = result.citedTerm?.rubricRef;
    const refOk = Boolean(ref) && ctx.validRubricRefs.includes(ref!);
    if (result.confidence < 0.6 || !refOk || !result.reason.trim()) {
      return {
        result: passResult(),
        downgradedFrom: downgradedFrom ?? "moderate",
        failedOpen: false,
        memoryClamped,
        blocks: false,
      };
    }
  }

  if (result.tier === "pass") {
    result = { ...passResult(), reframeAvailable: result.reframeAvailable };
  }

  if (!ctx.rubricRequiresCounterargument && suggestsCounterargument(result)) {
    result = stripCounterargument(result, false);
    if (!result.reason.trim() && result.tier !== "pass") {
      result = passResult();
      downgradedFrom = downgradedFrom ?? raw.tier;
    }
  }

  return {
    result,
    downgradedFrom,
    failedOpen: false,
    memoryClamped,
    blocks: false,
  };
}

export function stage4Complete(
  sections: { status: string; logicTier?: string | null }[],
): boolean {
  return sections.length > 0 && sections.every((section) => section.status === "confirmed");
}

/** Deterministic coach for known classroom cases and offline checks. */
export function logicCheckFromNotes(input: {
  notes: string;
  assignmentText: string;
  rubricRef: string;
  mode: "lesson" | "memory";
}): LogicCheckResult {
  const notes = input.notes;
  const cautious = /cautionary|warning|critically|without ethics/i.test(notes);
  const hitlerMoral = /hitler/i.test(notes) && /objectively moral|moral leader/i.test(notes);
  if (hitlerMoral && !cautious) {
    const quoteMatch = input.assignmentText.match(/evaluate leaders against ethical principles/i);
    const quote = quoteMatch?.[0] ?? "ethical principles";
    return {
      tier: "strong",
      basis: "contradicts_assignment",
      confidence: 0.92,
      reason: "Calling that leader objectively moral conflicts with evaluating leaders against ethical principles.",
      citedTerm: { rubricRef: input.rubricRef, quote },
      studentClaimRef: {
        ideaId: "claim",
        quote: notes.slice(0, 160),
      },
      logicFailure: null,
      alternativeAngles: [
        {
          question: "What ethical principle does this claim fail to meet?",
          rubricRef: input.rubricRef,
        },
      ],
      reframeAvailable: true,
    };
  }
  if (/hitler/i.test(notes) && cautious) {
    return passResult();
  }
  if (/maybe|might|could be read either way|debatable/i.test(notes)) {
    return {
      tier: "moderate",
      basis: "debatable_interpretation",
      confidence: 0.72,
      reason: "A reasonable reader could see this another way.",
      citedTerm: { rubricRef: input.rubricRef, quote: input.assignmentText.slice(0, 80) },
      studentClaimRef: { ideaId: "claim", quote: notes.slice(0, 160) },
      logicFailure: null,
      alternativeAngles: [
        { question: "Which part of the assignment makes you most sure?", rubricRef: input.rubricRef },
      ],
      reframeAvailable: false,
    };
  }
  const overgeneral = /\b(all|every|always|everyone|never)\b/i.test(notes);
  const anecdotal = /\b(my friend|my mom|my dad|someone i know|i know someone)\b/i.test(notes);
  if (overgeneral || anecdotal) {
    return {
      tier: "strong",
      basis: "defies_logic",
      confidence: 0.9,
      reason:
        overgeneral && anecdotal
          ? "One person's story cannot show that this happens to everyone."
          : overgeneral
            ? "A claim about everyone needs more than a single pattern."
            : "One example cannot carry the whole claim.",
      citedTerm: { rubricRef: input.rubricRef, quote: input.assignmentText.trim().slice(0, 80) || "this assignment" },
      studentClaimRef: { ideaId: "claim", quote: notes.slice(0, 160) },
      logicFailure: "One example does not prove a claim about everyone.",
      alternativeAngles: [
        {
          question: "What would count as evidence beyond one person's experience?",
          rubricRef: input.rubricRef,
        },
      ],
      reframeAvailable: true,
    };
  }
  const thin = isThinAnswer(notes, 12).thin;
  const addressed = notesAddressAssignment(notes, input.assignmentText);
  if (thin || !addressed) {
    const quote = input.assignmentText.trim().slice(0, 80) || "this assignment";
    return {
      tier: "moderate",
      basis: "weak_support",
      confidence: 0.74,
      reason: thin
        ? "This note is too thin to call solid. Add a concrete claim in your own words."
        : "This doesn't yet speak to what the assignment asks.",
      citedTerm: { rubricRef: input.rubricRef, quote },
      studentClaimRef: notes.trim()
        ? { ideaId: "claim", quote: notes.slice(0, 160) }
        : null,
      logicFailure: null,
      alternativeAngles: [
        {
          question: thin
            ? "What is one specific point you want this section to make?"
            : "Which part of the assignment is this section answering?",
          rubricRef: input.rubricRef,
        },
      ],
      reframeAvailable: false,
    };
  }
  return passResult();
}

const ADDRESS_STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "your",
  "about",
  "have",
  "what",
  "when",
  "where",
  "which",
  "would",
  "could",
  "their",
  "there",
  "they",
  "into",
  "than",
  "then",
  "just",
  "like",
  "some",
  "more",
  "also",
  "been",
  "were",
  "assignment",
  "paper",
  "write",
  "writing",
]);

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !ADDRESS_STOP.has(word));
}

/** A pass needs the student's words to touch the assignment, not just be long. */
export function notesAddressAssignment(notes: string, assignment: string): boolean {
  const asked = contentWords(assignment);
  if (asked.length === 0) return wordCount(notes) >= 40;
  const said = new Set(contentWords(notes));
  return asked.some((word) => said.has(word));
}
