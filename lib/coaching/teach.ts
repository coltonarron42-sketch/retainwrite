// SOP: coaching only, never generate submission text

import { z } from "zod";
import { pickPhrase } from "@/lib/stage1/paper-context";
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
        : // QA 10:21: never the assignment's clause read back as the lesson.
          "The key idea this part of your paper has to show. Say what it means in your own words, then find one real moment that shows it.",
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
    ask: concept.toLowerCase() === "servant leadership" ? askForConcept(concept) : "What's one real moment that shows your idea in action?",
  };
  return card;
}

/**
 * The quick lesson with real content (QA 11/23: the Body chip was an empty,
 * truncated template): the material's key point and the student's real options.
 */
export function contextTeachCard(
  b: { summary: { points: string[] } | null; options?: { question: string; options: { label: string; why: string }[] } | null; decision?: { pick: string; answer?: string } | null } | null,
  rubricRef: string,
): TeachCard | null {
  const opts = b?.options?.options ?? [];
  const point = (b?.summary?.points ?? []).find((p) => wordCount(p) <= 35) ?? null;
  // QA 9:37 AM: after a pick, the lesson is about THEIR pick (never "You picked their own."),
  // and the options are not offered again.
  // PC-30 QA: every style they picked ("servant and transformational leadership"), never just one.
  const picked = b?.decision ? pickPhrase(b.decision, opts) : null;
  const several = Boolean(picked && / and /.test(picked));
  if (b?.decision) {
    if (!picked) return null;
    return {
      concept: picked,
      rubricRef,
      affirm: null,
      definition: point ?? `${picked} ${several ? "are the ideas" : "is the idea"} this section has to show in action, with a real moment a reader can picture.`,
      qualities: ["What it means, in your words", "One moment that shows it", "Why it fits a team going through change"],
      showsUpAs: ["A decision you can point to", "What changed for the people involved"],
      debate: null,
      ask: `You picked ${picked}. Which moment shows it best?`,
    };
  }
  if (opts.length < 2) return null;
  const labels = opts.map((o) => o.label.replace(/[.!?]+$/, "").trim()).filter((l) => l && wordCount(l) <= 10);
  if (labels.length < 2) return null;
  return {
    concept: "your options",
    rubricRef,
    affirm: null,
    // Never the assignment's own question read back as the lesson (QA 8:31 AM).
    definition: point ?? "Each of these puts the weight somewhere different. Knowing what each one means helps you pick evidence that really fits.",
    qualities: labels.slice(0, 3),
    showsUpAs: opts.slice(0, 2).map((o) => o.why.replace(/[.!?]+$/, "")).filter((w) => w && wordCount(w) <= 12),
    debate: null,
    ask: "Which of these could you build this section around?",
  };
}

/**
 * A real concept lesson (QA 8:31 AM: the Body "Quick lesson" parroted the assignment).
 * General, well-established definitions of the style they picked; never what a chapter says.
 */
const STYLE_LESSONS: { when: RegExp; concept: string; definition: string; qualities: string[]; showsUpAs: string[] }[] = [
  {
    when: /\btransformational\b/i,
    concept: "transformational leadership",
    definition: "Leading by inspiring people with a shared vision, so they want the change and stretch past what they thought they could do.",
    qualities: ["A clear, shared vision", "Inspiring people to buy in", "Personal attention to each person", "Pushing people to think in new ways"],
    showsUpAs: ["A leader explaining why the change matters", "People taking ownership of the new direction"],
  },
  {
    when: /\bsituational\b/i,
    concept: "situational leadership",
    definition: "Leading by matching your style to how ready each person or team is: more direction when they're new, more freedom as they grow.",
    qualities: ["Reading the team's readiness", "Directing when skills are low", "Coaching and supporting in between", "Delegating once people are ready"],
    showsUpAs: ["Clear steps early in a change", "Handing off decisions as confidence grows"],
  },
  {
    when: /\bservant\b/i,
    concept: "servant leadership",
    definition: "A way of leading that puts other people's growth and needs ahead of the leader's status.",
    qualities: ["Listening before deciding", "Putting the team's needs first", "Helping other people grow", "Stepping back from status"],
    showsUpAs: ["Choices that put people ahead of status", "Habits other people can point to"],
  },
  {
    when: /\b(behavioral|task vs\.? relationship|team management|task|relationship)\b/i,
    concept: "task vs. relationship leadership",
    definition: "Looking at what leaders actually do: how much they push to get the task done versus how much they care for the people doing it.",
    qualities: ["Task focus: goals, roles, deadlines", "Relationship focus: trust and support", "Balancing both at once", "Team management: high on both"],
    showsUpAs: ["Clear goals set for the change", "Check-ins on how people are coping"],
  },
];
export function conceptTeachCard(
  b: { decision?: { pick: string; answer?: string } | null; leader?: { pick: string } | null } | null,
  rubricRef: string,
): TeachCard | null {
  const said = `${b?.decision?.pick ?? ""} ${b?.decision?.answer ?? ""}`;
  const hit = STYLE_LESSONS.find((x) => x.when.test(said));
  if (!hit) return null;
  const who = b?.leader?.pick && b.leader.pick !== "their own" ? b.leader.pick : "your leader";
  const card: TeachCard = {
    concept: hit.concept,
    rubricRef,
    affirm: null,
    definition: hit.definition,
    qualities: hit.qualities,
    showsUpAs: hit.showsUpAs,
    debate: null,
    ask: `Which of these did ${who} actually do, and when?`,
  };
  return guardTeachCard(card).ok ? card : null;
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
