// SOP: coaching only, never generate submission text

import { z } from "zod";
import { asQuestion, isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";
import { wordCount } from "@/lib/utils";

export const teachCardSchema = z.object({
  concept: z.string().max(60),
  rubricRef: z.string(),
  affirm: z.string().max(100).nullable(),
  definition: z.string().max(240),
  qualities: z.array(z.string().max(70)).min(3).max(5),
  showsUpAs: z.array(z.string().max(90)).min(2).max(3),
  debate: z.string().max(110).nullable(),
  ask: z.string().max(140),
});

export type TeachCard = z.infer<typeof teachCardSchema>;

export const TEACH_FOOTER =
  "This is for learning. In your paper, define it in your own words and cite a real source.";

export const KNOW_THIS_ONE = "I know this one";
export const SOMETHING_ELSE = "Something else";

function fragmentIsSentence(text: string): boolean {
  const value = text.trim();
  if (/[.!?;]$/.test(value)) return true;
  return /\b(is|are|was|were|has|have|does|do|did)\b/i.test(value);
}

function namesAPerson(definition: string, concept: string): boolean {
  const conceptWords = new Set(concept.toLowerCase().split(/\s+/));
  const matches = definition.match(/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g) ?? [];
  return matches.some((name) =>
    name
      .toLowerCase()
      .split(/\s+/)
      .some((part) => !conceptWords.has(part)),
  );
}

export function guardTeachCard(card: TeachCard): { ok: true } | { ok: false; reason: string } {
  const parsed = teachCardSchema.safeParse(card);
  if (!parsed.success) return { ok: false, reason: "schema" };
  if (wordCount(card.definition) > 35) {
    return { ok: false, reason: "definition over 35 words" };
  }
  if (card.affirm && wordCount(card.affirm) > 15) {
    return { ok: false, reason: "affirm over 15 words" };
  }
  if (!card.ask.trim().endsWith("?")) {
    return { ok: false, reason: "ask must be a question" };
  }
  if (/according to\b/i.test(card.definition) || /\(\d{4}\)/.test(card.definition)) {
    return { ok: false, reason: "definition cites a source" };
  }
  if (namesAPerson(card.definition, card.concept)) {
    return { ok: false, reason: "definition names a person" };
  }
  for (const item of [...card.qualities, ...card.showsUpAs]) {
    if (wordCount(item) > (card.qualities.includes(item) ? 10 : 12)) {
      return { ok: false, reason: "bullet is too long" };
    }
    if (fragmentIsSentence(item)) {
      return { ok: false, reason: "bullet is a sentence" };
    }
  }
  return { ok: true };
}

export function askForConcept(concept: string): string {
  if (isQuestionTopic(concept)) return `Which part of this question interests you most: “${asQuestion(concept)}”`;
  return `Which part of ${topicMidSentence(concept)} interests you most?`;
}

export function defaultTeachCard(concept: string, rubricRef: string): TeachCard {
  const card: TeachCard = {
    concept,
    rubricRef,
    affirm: null,
    definition:
      concept.toLowerCase() === "servant leadership"
        ? "A way of leading that puts other people's growth and needs ahead of the leader's status."
        : isQuestionTopic(concept)
          ? "The question your assignment asks you to answer. Understand what it's really asking before you pick examples."
          : `A concept your assignment asks you to understand before you pick examples of ${topicMidSentence(concept)}.`,
    qualities:
      concept.toLowerCase() === "servant leadership"
        ? [
            "Listening before deciding",
            "Putting the team's needs first",
            "Helping other people grow",
            "Stepping back from status",
          ]
        : [
            "A clear definition in your words",
            "A few visible qualities",
            "A moment where it shows up",
          ],
    showsUpAs:
      concept.toLowerCase() === "servant leadership"
        ? ["Choices that put people ahead of status", "Habits other people can point to"]
        : ["A moment from the assignment", "A choice you can point to"],
    debate: null,
    ask: askForConcept(concept),
  };
  return card;
}

/**
 * The quick lesson with real content (QA 11/23: the Body chip was an empty,
 * truncated template): the material's key point and the student's real options.
 */
export function contextTeachCard(
  b: { summary: { points: string[] } | null; options?: { question: string; options: { label: string; why: string }[] } | null; decision?: { pick: string } | null } | null,
  rubricRef: string,
): TeachCard | null {
  const opts = b?.options?.options ?? [];
  if (opts.length < 2) return null;
  const point = (b?.summary?.points ?? []).find((p) => wordCount(p) <= 35) ?? null;
  const labels = opts.map((o) => o.label.replace(/[.!?]+$/, "").trim()).filter((l) => l && wordCount(l) <= 10);
  if (labels.length < 2) return null;
  return {
    concept: "your options",
    rubricRef,
    affirm: null,
    definition: point ?? `${b!.options!.question.replace(/\?$/, "")}: ${labels.join(", ")}.`.slice(0, 220),
    qualities: labels.slice(0, 3),
    showsUpAs: opts.slice(0, 2).map((o) => o.why.replace(/[.!?]+$/, "")).filter((w) => w && wordCount(w) <= 12),
    debate: null,
    ask: b?.decision?.pick ? `You picked ${b.decision.pick}. Which of these could you build this section around?` : "Which of these could you build this section around?",
  };
}

const VAGUE_CONCEPT =
  /\b(servant leadership|leadership styles?|transformational leadership|theme|theory|framework)\b/i;

export type TeachThenAsk =
  | { kind: "teach_then_ask"; card: TeachCard }
  | { kind: "thin_probe"; prompt: string };

export function teachThenAsk(answer: string, rubricRef = "lesson_concept"): TeachThenAsk {
  const text = answer.trim();
  const conceptMatch = text.match(VAGUE_CONCEPT);
  if (!conceptMatch) {
    return {
      kind: "thin_probe",
      prompt: "What's one concrete moment you could use here?",
    };
  }
  const phrase = conceptMatch[1]!.toLowerCase();
  const concept = phrase.startsWith("servant")
    ? "servant leadership"
    : phrase.includes("style")
      ? "leadership styles"
      : phrase;
  const base = defaultTeachCard(concept, rubricRef);
  const card: TeachCard = {
    ...base,
    affirm: "Servant leadership is a strong pick for this paper.".includes(concept)
      ? null
      : null,
  };
  if (concept === "servant leadership") {
    card.affirm = "Servant leadership is a strong pick for this paper.";
  } else {
    card.affirm = `${concept} is a strong pick for this paper.`;
  }
  const guard = guardTeachCard(card);
  if (!guard.ok) {
    return { kind: "thin_probe", prompt: "What's one concrete moment you could use here?" };
  }
  return { kind: "teach_then_ask", card };
}

export type LoopStep =
  | "teach"
  | "probe"
  | "search"
  | "summarize"
  | "confirm"
  | "logic_check"
  | "confirmed";

export const LOOP_STEP_ORDER: LoopStep[] = [
  "teach",
  "probe",
  "search",
  "summarize",
  "confirm",
  "logic_check",
  "confirmed",
];

export type TeachStatus =
  | "explored"
  | "skipped_known"
  | "skipped"
  | "not_applicable"
  | "mirrored";

const TEACH_DONE = new Set<TeachStatus>([
  "explored",
  "skipped_known",
  "skipped",
  "not_applicable",
  "mirrored",
]);

export function teachIsDone(status: TeachStatus | null): boolean {
  return status != null && TEACH_DONE.has(status);
}

/** TEACH never blocks: skip and "I know this one" always open PROBE. */
export function exitTeach(status: TeachStatus): { teachStatus: TeachStatus; blocks: false } {
  return { teachStatus: status, blocks: false };
}
