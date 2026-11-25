/**
 * Stage 1 chat copy: Pau's voice for the question thread.
 * SOP: coaching only. Prompts and nudges; never paper content.
 */

/** Placeholders in Pau's voice, one per question. */
export const PLACEHOLDERS: Record<string, string> = {
  interest_1: "A show, a sport, a game, a person… anything you're into",
  interest_2: "Tell me about it, even a sentence helps",
  bg_comfort: "Tap one above, or tell me in your own words",
  coaching_take: "Your first guess is fine; there's no wrong answer",
  personal_1: "A moment you remember, in a few sentences",
  fallback_voice: "Write it the way you'd say it out loud",
  stance_early: "What do you think right now, and why?",
};

/** Short opening bubbles after "Let's go": one idea each; the voice sample is mentioned once, here. */
export const INTRO_BUBBLES = [
  "Okay, a few quick questions so I can actually coach you on this one.",
  "Your answers also show me how you write. So just use your own words. No polish needed.",
];

/** Pau's nudge when an answer is under its minimum. */
const OPENERS = ["Give me a little more — a couple more sentences?", "Closer.", "Getting there.", "One more push."];
export const MORE_WORDS_NOTE = /^(Give me a little more|Closer\.|Getting there\.|One more push\.|No rush, that one doesn't count|All good, that one doesn't count)/;
/**
 * QA 8:31 AM: never the same line every time. Each try gets a different opener and
 * points at what's actually missing from what they wrote (the claim, the reason, the example).
 */
export function moreWordsNote(_have: number, _need: number, what: string, text = "", attempt = 0): string {
  // No counts in the visible copy; keep it a nudge, not a meter.
  const opener = OPENERS[attempt % OPENERS.length]!;
  const t = text.trim();
  if (!t) return `${opener} ${what} is almost there. Add to it below.`;
  const reason = /\b(because|since|so that|so it|which (means|lets|helps)|that way|it (helps|lets|gets|makes)|cuz|cause)\b/i.test(t);
  const example = /\b(for example|for instance|like when|such as|at [A-Z]\w+|[A-Z][a-z]+ [A-Z][a-z]+)\b/.test(t) || /\b(when (he|she|they)|did|led|changed|turned)\b/i.test(t);
  const claim = /\b(i think|i'?d argue|i want to argue|i believe|works? best|is (the )?(best|most)|better|transformational|situational|servant|democratic|task|relationship)\b/i.test(t);
  const need = !claim
    ? "Start with what you think, in one plain sentence."
    : !reason
      ? "You've got your pick. Now the why: what makes it the right call for this assignment?"
      : !example
        ? "You've got a pick and a reason. Add the example: who or what shows it, and what actually happened?"
        : "Take one part further: what happened because of it, and why does that matter for your point?";
  return `${opener} ${need}`;
}

/**
 * Pau's first words in Stage 1, above "What's the assignment…". It is read
 * aloud too, so the student hears how the name sounds ("Pow").
 */
export const ASSIGNMENT_GREETING = "Hi, I'm Pau.";

/** Pau's first question, in the same reply as the greeting. */
export const ASSIGNMENT_ASK = "What's the assignment we're working on?";
