/**
 * Stage 1 chat copy: Pau Pau's voice for the question thread.
 * SOP: coaching only. Prompts and nudges; never paper content.
 */

/** Placeholders in Pau Pau's voice, one per question. */
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
  "Now a few quick questions, so I can coach you on this one.",
  "Your answers also show me how you write, so use your own words. No need to polish.",
];

/** Pau Pau's nudge when an answer is under its minimum. */
export function moreWordsNote(_have: number, _need: number, what: string): string {
  // No counts in the visible copy; keep it a nudge, not a meter.
  return `Give me a little more — a couple more sentences? ${what} is almost there. Add to it below.`;
}


/**
 * Pau Pau's first words in Stage 1, above "What's the assignment…". It is read
 * aloud too, so the student hears how the name sounds ("Pow pow").
 */
export const ASSIGNMENT_GREETING = "Hi, I'm Pau Pau.";
