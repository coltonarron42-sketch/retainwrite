import { dropHedges } from "@/lib/copy/tidy";
import { tidyQuotePunct } from "@/lib/copy/quote-punct";
import { firstSentenceOf } from "@/lib/copy/sentences";
// SOP: coaching only, never generate submission text

import { z } from "zod";
import { isVerbatimSubstring } from "@/lib/coaching/lesson";
import { isThinAnswer } from "@/lib/coaching/thin";
import { wordCount } from "@/lib/utils";

export const LOGIC_OPENER = "Quick logic check. You feel good about this?";
export const LOGIC_YES = "Yes, check it";
export const LOGIC_TWEAK = "Let me tweak it first";
export const LOGIC_PASS = "Logic check ✓ Looks solid.";
export const LOGIC_ALERT_LABEL = "Logic alert";
export const LOGIC_STRONG_HEADLINE = "Hold up. This needs a fix before you move on.";
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
  reason: z.string().max(600),
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

/** Quote the student's claim on a word boundary. Never cut a word like "healt". */
export function quoteOnWordBoundary(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > 24 ? cut.slice(0, boundary) : cut).trim();
}

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
/** The alert quotes the confirmed prompt or topic, on a word boundary, never a raw-paste fragment. */
export function assignmentAlertQuote(input: {
  confirmedPrompt?: string | null;
  confirmedTopic?: string | null;
  raw?: string | null;
}): string {
  const formatLine = /^\(?\d{3,5}\s*words?\b/i;
  const preferred = [input.confirmedPrompt, input.confirmedTopic]
    .map((value) => value?.replace(/\s+/g, " ").trim() ?? "")
    .find((value) => value && !formatLine.test(value));
  const source = preferred || input.raw?.replace(/\s+/g, " ").trim() || "this assignment";
  const sentence = firstSentenceOf(source) || source;
  return quoteOnWordBoundary(sentence, 140);
}

const NEG_WORD = /\b(bad|worse|worst|wrong|fail(?:s|ed|ing)?|weak|ineffective|hurts?|harmful|poor(?:ly)?|mistake|doesn'?t work|didn'?t work|not work|backfire[sd]?|outdated|useless|overrated|falls? short|less effective|isn'?t (?:really )?(?:the )?(?:best|right|effective|good)|not (?:really )?(?:the )?(?:best|right|effective)|doesn'?t (?:help|matter))\b/i;
const NAME_STOP = new Set(["I", "The", "This", "That", "My", "So", "And", "But", "If", "When", "It", "In", "On", "For", "A", "An", "Also", "Then", "Because", "Yes", "No", "Overall", "Chapter"]);
const PHRASE_STOP = new Set(["is", "are", "was", "were", "be", "the", "a", "an", "and", "or", "but", "so", "for", "to", "of", "in", "on", "it", "that", "this", "i", "my", "way", "much", "probably", "really", "very", "did", "do", "does", "with", "than", "more", "most", "because", "think", "would", "pick"]);

function clauses(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/[.;!?]|,\s*(?:so|and|but)\b|\b(?:so|but|while|whereas)\b/i).map((c) => c.trim()).filter(Boolean);
}

/** Two-word phrases ("team management") and names ("Barra") in a clause. */
function claimTerms(clause: string): string[] {
  const out: string[] = [];
  for (const m of clause.matchAll(/\b([A-Z][a-z'’]{2,})\b/g)) if (!NAME_STOP.has(m[1]!)) out.push(m[1]!.toLowerCase());
  const words = clause.toLowerCase().replace(/[^a-z'\s-]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i]!, b = words[i + 1]!;
    if (a.length > 3 && b.length > 3 && !PHRASE_STOP.has(a) && !PHRASE_STOP.has(b) && !NEG_WORD.test(a) && !NEG_WORD.test(b)) out.push(`${a} ${b}`);
  }
  return out;
}

/**
 * QA 7:11 AM: a note that turns against the student's own thesis ("team management is bad
 * for change … so Barra probably did it wrong" after a thesis backing team management and
 * Barra). Returns what it contradicts, or null.
 */
export function contradictsThesis(notes: string, thesis: string): { term: string; noteQuote: string; thesisQuote: string } | null {
  if (!notes.trim() || !thesis.trim()) return null;
  const backed = new Map<string, string>();
  for (const c of clauses(thesis)) {
    if (NEG_WORD.test(c)) continue;
    for (const t of claimTerms(c)) if (!backed.has(t)) backed.set(t, c);
  }
  for (const c of clauses(notes)) {
    if (!NEG_WORD.test(c)) continue;
    for (const t of claimTerms(c)) {
      const from = backed.get(t);
      if (from) return { term: t, noteQuote: c, thesisQuote: from };
    }
  }
  return null;
}

export function logicCheckFromNotes(input: {
  notes: string;
  /** The student's own thesis (their Stage 1 decision, their thesis/intro notes): a note may not turn against it. */
  thesis?: string | null;
  assignmentText: string;
  rubricRef: string;
  mode: "lesson" | "memory";
  confirmedPrompt?: string | null;
  confirmedTopic?: string | null;
  /** The model's relevance verdict when it answered; rules decide otherwise. */
  onPrompt?: boolean | null;
}): LogicCheckResult {
  const assignmentQuote = assignmentAlertQuote({
    confirmedPrompt: input.confirmedPrompt,
    confirmedTopic: input.confirmedTopic,
    raw: input.assignmentText,
  });
  const notes = input.notes;
  // Relevance first (QA 10:38 #4): a claim that doesn't touch the prompt is
  // named as off-prompt before any critique of how it reasons.
  const promptText = input.confirmedPrompt?.trim() || input.confirmedTopic?.trim() || "";
  const onPrompt = typeof input.onPrompt === "boolean" ? input.onPrompt : notesOnPrompt(notes, promptText, input.assignmentText);
  if (promptText && notes.trim() && !onPrompt) {
    const asked = quoteOnWordBoundary(firstSentenceOf(promptText) || promptText, 140);
    return {
      tier: "strong",
      basis: "contradicts_assignment",
      confidence: 0.9,
      reason: `This doesn't answer the question your prompt asks: “${asked}”`,
      citedTerm: { rubricRef: "prompt", quote: asked },
      studentClaimRef: { ideaId: "claim", quote: quoteOnWordBoundary(notes, 160) },
      logicFailure: null,
      alternativeAngles: [{ question: tidyQuotePunct(`How does this connect to “${asked}”?`).slice(0, 160), rubricRef: "prompt" }],
      reframeAvailable: true,
    };
  }
  // A note that turns against their own thesis is named, with continue-anyway (QA 7:11 AM).
  const against = input.thesis ? contradictsThesis(notes, input.thesis) : null;
  if (against) {
    // QA 9:37 AM: whole sentences, never cut mid-word ("arg.", "for…").
    const said = wholeQuote(against.noteQuote);
    const thesisSaid = wholeQuote(against.thesisQuote);
    return {
      tier: "moderate",
      basis: "defies_logic",
      confidence: 0.8,
      reason: `This says “${said}”, but your thesis says “${thesisSaid}”. Which one does your paper argue?`,
      citedTerm: { rubricRef: input.rubricRef, quote: assignmentQuote },
      studentClaimRef: { ideaId: "claim", quote: quoteOnWordBoundary(against.noteQuote, 160) },
      logicFailure: "The note contradicts the thesis.",
      alternativeAngles: [{ question: `Which side of ${against.term} does your paper argue, and does this section back it?`.slice(0, 160), rubricRef: input.rubricRef }],
      reframeAvailable: true,
    };
  }
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
        quote: quoteOnWordBoundary(notes, 160),
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
      citedTerm: { rubricRef: input.rubricRef, quote: assignmentQuote },
      studentClaimRef: { ideaId: "claim", quote: quoteOnWordBoundary(notes, 160) },
      logicFailure: null,
      alternativeAngles: [
        { question: "Which part of the assignment makes you most sure?", rubricRef: input.rubricRef },
      ],
      reframeAvailable: false,
    };
  }
  // Severe is only for off-topic (above) or self-contradictory claims. A
  // personal example backing an opinion is normal: at most a gentle nudge.
  if (selfContradicts(notes)) {
    return {
      tier: "strong",
      basis: "defies_logic",
      confidence: 0.85,
      reason: "This note argues both sides of the same point, so a reader can't tell what you think.",
      citedTerm: { rubricRef: input.rubricRef, quote: assignmentQuote },
      studentClaimRef: { ideaId: "claim", quote: quoteOnWordBoundary(notes, 160) },
      logicFailure: "The claim contradicts itself.",
      alternativeAngles: [{ question: "Which side do you actually want this section to argue?", rubricRef: input.rubricRef }],
      reframeAvailable: true,
    };
  }
  const universal = UNIVERSAL.test(notes);
  const anecdotal = ANECDOTE.test(notes) && !EVIDENCE_WORDS.test(notes);
  if (universal || anecdotal) {
    return {
      tier: "moderate",
      basis: "weak_support",
      confidence: 0.7,
      reason: anecdotal ? ANECDOTE_NUDGE : UNIVERSAL_NUDGE,
      citedTerm: { rubricRef: input.rubricRef, quote: assignmentQuote },
      studentClaimRef: { ideaId: "claim", quote: quoteOnWordBoundary(notes, 160) },
      logicFailure: null,
      alternativeAngles: [
        { question: anecdotal ? "What else (a study, a number, another case) shows the same thing?" : "What evidence could show how widely this holds?", rubricRef: input.rubricRef },
      ],
      reframeAvailable: false,
    };
  }
  const thin = isThinAnswer(notes, 12).thin;
  // The relevance verdict (model, or the rules above) already said on-topic:
  // don't second-guess it with a cruder word match (QA 12:25 #1).
  const addressed = onPrompt || notesAddressAssignment(notes, input.assignmentText);
  if (thin || !addressed) {
    const quote = assignmentQuote;
    return {
      tier: "moderate",
      basis: "weak_support",
      confidence: 0.74,
      reason: thin
        ? "This note is too thin to call solid. Add a concrete claim in your own words."
        : "This doesn't yet speak to what the assignment asks.",
      citedTerm: { rubricRef: input.rubricRef, quote },
      studentClaimRef: notes.trim()
        ? { ideaId: "claim", quote: quoteOnWordBoundary(notes, 160) }
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
  if (timeCue(notes, assignment)) return true;
  const said = contentWords(notes).map(stem);
  const set = new Set(said);
  return asked.map(stem).some((w) => set.has(w) || (w.length >= 4 && said.some((x) => x.length > w.length && x.includes(w))));
}

const TIME_PROMPT = /\b(start|starts|starting|bell|schedule|morning|early|earlier|later|time|times|hour|hours)\b/i;
const TIME_NOTE =
  /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(am|a\.m\.|pm|p\.m\.)|\bo'?clock\b|\bfirst (period|class|hour|block)\b|\bzero period\b|\bbells?\b|\bstart(s|ing|ed)?\b|\blater\b|\bearl(y|ier)\b|\bmornings?\b/i;

/** A prompt about timing (start times, schedules) is answered by "8:30", "first period", "the bell", "later". */
export function timeCue(notes: string, promptOrSheet: string): boolean {
  return TIME_PROMPT.test(promptOrSheet) && TIME_NOTE.test(notes);
}

export const ANECDOTE_NUDGE = "One example is a great start; what else shows this?";
export const UNIVERSAL_NUDGE = "Claims about everyone are hard to back up. What else would show how widely this holds?";
/** A claim about all people, not "every school morning". */
const UNIVERSAL = /\b(everyone|everybody|no one|nobody|all (people|students|teens|teenagers|kids|children|americans|humans|parents|teachers))\b/i;
const ANECDOTE =
  /\b(my (little |older |big |younger )?(sister|brother|mom|mother|dad|father|friend|friends|cousin|family|parents|aunt|uncle|grandma|grandpa|grandmother|grandfather|neighbor|teacher|coach)|someone i know|i know someone|i (noticed|saw|remember)|in my (school|town|class|family)|my own)\b/i;
const EVIDENCE_WORDS = /\b(stud(y|ies)|research|data|survey|report|statistic|percent|%|scientists?|experts?|according to)\b/i;

/** "X should Y … X should not Y" (same verb after both), "is good … is not good". */
export function selfContradicts(notes: string): boolean {
  const t = notes.toLowerCase().replace(/n't\b/g, " not");
  for (const aux of ["should", "must", "is", "are", "will", "can", "does", "do"]) {
    const yes = new Set([...t.matchAll(new RegExp(`\\b${aux} (?!not\\b)(\\w{3,})`, "g"))].map((m) => m[1]));
    const no = [...t.matchAll(new RegExp(`\\b${aux} not (\\w{3,})`, "g"))].map((m) => m[1]);
    if (no.some((w) => yes.has(w))) return true;
  }
  return false;
}

/** Stems too common to show a note is about the prompt. */
const TOPIC_GENERIC = new Set([
  "school", "day", "time", "people", "person", "high", "good", "great", "best", "thing", "way", "life", "world",
  "year", "made", "make", "part", "lot", "really", "honest", "honestly", "every", "everyone", "think", "know", "want",
  "even", "ever", "much", "many", "most", "other", "only", "same", "real",
]);

const SHEET_GENERIC = new Set([
  "student", "students", "source", "sources", "research", "page", "pages", "essay", "format", "cite", "citation",
  "words", "word", "include", "must", "should", "class", "grade", "graded", "due", "date", "paper", "argument",
  "evidence", "claim", "thesis", "example", "examples", "question", "prompt", "answer", "explain", "describe",
  "discuss", "analyze", "your", "least", "peer", "reviewed", "double", "spaced", "font", "points", "rubric",
  "draft", "final", "submit", "introduction", "conclusion", "body", "section", "sections", "best", "good", "make",
]);

function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "");
}

function stems(text: string, skip?: Set<string>): Set<string> {
  return new Set(
    contentWords(text)
      .filter((w) => !skip?.has(w) && !/^(should|does|did|how|why|whether|which)$/.test(w))
      .map(stem)
      .filter((w) => w.length > 2),
  );
}

/** Does the note touch the confirmed prompt (or, failing that, the sheet's own topic words)? */
export function notesOnPrompt(notes: string, prompt: string, sheet = ""): boolean {
  const said = stems(notes);
  if (said.size === 0) return true;
  // Everyday words ("school", "day", "people") don't make a note on-topic:
  // "the cafeteria pizza is the best part of any school day" is about pizza.
  if (timeCue(notes, prompt)) return true;
  const saidWords = [...said];
  // "asleep" is about "sleep": a topic stem inside a longer word counts.
  const hit = (w: string) => !TOPIC_GENERIC.has(w) && (said.has(w) || (w.length >= 4 && saidWords.some((x) => x.length > w.length && x.includes(w))));
  for (const w of stems(prompt)) if (hit(w)) return true;
  for (const w of stems(sheet, SHEET_GENERIC)) if (hit(w)) return true;
  return false;
}

/** A whole sentence to quote back: hedges dropped, end punctuation trimmed, never clipped mid-word. */
export function wholeQuote(sentence: string): string {
  return dropHedges(sentence).replace(/\s+/g, " ").replace(/[\s.,;:!?…]+$/, "").trim();
}

