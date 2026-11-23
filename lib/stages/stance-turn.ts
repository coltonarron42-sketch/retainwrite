/**
 * Stages 2 and 3 as Pau Pau chat turns (PLAN.md 9). Pure helpers, so the
 * gates stay exactly what the old panels enforced:
 *
 * - `stanceTurnFor` decides which ONE turn Pau Pau is on, from the same
 *   section state the old panels were shown from (one panel ⇔ one turn).
 * - `afterProbe` / `afterMirror` / `outlineSectionsForContinue` are the old
 *   inline transitions, lifted out unchanged.
 *
 * Pau Pau only asks and reflects. Every note, outline line, and lead name in
 * the session is the student's own text.
 */
import { keptIdeas } from "@/lib/coaching/thin";
import { replaceClaim } from "@/lib/coaching/logicRevision";

export type StanceTurnKind =
  | "teach_card"
  | "mirror"
  | "probe"
  | "name_lead"
  | "pick_lead"
  | "confirm"
  | "logic_opener"
  | "logic_result"
  | "locked_in"
  | "none";

export type StanceTurnInput = {
  mode: "lesson" | "memory";
  loopStep: string;
  status: string;
  hasLogic: boolean;
  logicRevealed: boolean;
};

/**
 * Which turn is current. Mirrors the old render conditions one-for-one:
 * teach card (lesson + teach + card), mirror (memory + teach), probe,
 * search without directions (name your own), search with a batch (pick one),
 * summarize/confirm, logic opener (not yet revealed), logic result.
 */
export function stanceTurnFor(
  s: StanceTurnInput,
  opts: { hasCard: boolean; personalized: boolean; hasBatch: boolean },
): StanceTurnKind {
  if (s.loopStep === "teach") {
    if (s.mode === "lesson") return opts.hasCard ? "teach_card" : "none";
    return "mirror";
  }
  if (s.loopStep === "probe") return "probe";
  if (s.loopStep === "search") {
    if (!opts.personalized) return "name_lead";
    return opts.hasBatch ? "pick_lead" : "none";
  }
  if (s.loopStep === "summarize" || s.loopStep === "confirm") return "confirm";
  if (s.loopStep === "logic_check") {
    if (!s.hasLogic) return "none";
    return s.logicRevealed ? "logic_result" : "logic_opener";
  }
  if (s.status === "confirmed" || s.loopStep === "confirmed") return "locked_in";
  return "none";
}

/** The step after a saved probe idea (old "Save this idea"). */
export function afterProbe(
  section: { ideas: string[]; searchStatus: "required" | "not_needed" },
  idea: string,
  replacing: boolean,
): { ideas: string[]; loopStep: "summarize" | "search" } {
  const ideas = replacing ? replaceClaim(section.ideas, idea) : [...keptIdeas(section.ideas), idea];
  return { ideas, loopStep: section.searchStatus === "not_needed" ? "summarize" : "search" };
}

/** The step after the memory mirror (old "Save what it means to you"). */
export function afterMirror(section: { ideas: string[] }, idea: string): { ideas: string[]; loopStep: "probe" } {
  return { ideas: [...keptIdeas(section.ideas), idea], loopStep: "probe" };
}

/**
 * Old Stage 3 Continue: each section takes its outline draft, unless the draft
 * is blank or untouched (then the kept Stance ideas stay).
 */
export function outlineSectionsForContinue<T extends { key: string; ideas: string[] }>(
  sections: T[],
  drafts: Record<string, string | undefined>,
): T[] {
  return sections.map((item) => {
    const text = drafts[item.key]?.trim();
    if (!text || text === keptIdeas(item.ideas).join("\n")) return item;
    return { ...item, ideas: [text] };
  });
}

/** Stage 3: the next section to outline, one at a time; -1 when all are done. */
export function nextOutlineIndex(sections: { key: string }[], done: string[]): number {
  return sections.findIndex((s) => !done.includes(s.key));
}

/** A line of the Stage 2/3 conversation, kept on the session so a reload rebuilds it. */
/** "pick" is a tapped choice: shown as a small "Picked: …" chip, never as the student's words. */
export type LoopLine = { k: string; who: "pau" | "you" | "pick"; text: string };

export function appendLines(prev: LoopLine[] | undefined, lines: LoopLine[]): LoopLine[] {
  // Keep the saved session small: the last 80 lines are plenty to rebuild the chat.
  return [...(prev ?? []), ...lines.filter((l) => l.text.trim())].slice(-80);
}

/** Typed replies on a choice turn: a plain yes picks the main choice. */
const SPOKEN_YES_WORDS = new Set(
  "yes yeah yep yup ya sure ok okay alright lock it in looks sounds good great perfect lets let's go ahead do please that that's thats is right correct ready one i'm im happy with".split(" "),
);
const SPOKEN_YES_CORE = /\b(yes|yeah|yep|yup|sure|ok(ay)?|alright|lock it in|looks good|sounds good|let'?s go|go ahead|do it|perfect)\b/;
const SPOKEN_NO = /\b(no|not|don'?t|nope|wait|but|change|instead|actually|hold|stop|never)\b/;
/**
 * A clear spoken yes to a waiting choice ("Yes, lock it in", "yeah sounds
 * good"): short, only yes-words, no negation. Anything else is not a yes.
 * Grok Voice only; typed text keeps isPlainYes.
 */
export function isSpokenYes(text: string): boolean {
  const t = text.toLowerCase().replace(/[\u2019]/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\b(um+|uh+|so|like)\b/g, " ").trim();
  if (!t || SPOKEN_NO.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 8) return false;
  return words.every((w) => SPOKEN_YES_WORDS.has(w)) && SPOKEN_YES_CORE.test(t);
}

export function isPlainYes(text: string): boolean {
  return /^(y(es|ep|eah|up)?|sure|ok(ay)?|lock it in|looks good|sounds good|let'?s go|check it|go ahead|do it)[.!\s]*$/i.test(text.trim());
}
