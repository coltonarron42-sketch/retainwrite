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
  // Legacy questions (PC-32): only shown on older papers that already answered them.
  personal_1: "A moment you remember, in a few sentences",
  fallback_voice: "Write it the way you'd say it out loud",
  stance_early: "What do you think right now, and why?",
};

/**
 * Short opening bubble after "Let's go". PC-32 (Colton t219u, Nov 25): Stage 1 is the assignment,
 * its summary and a first direction; how they write is learned quietly in the background, so it
 * is never announced as a task here.
 */
export const INTRO_BUBBLES = [
  "Okay, a few quick questions so I can actually coach you on this one.",
];

/** Pau's nudge when an answer is under its minimum. */
// Round 4 #2: openers are statements; the line after is the one question (never two asks in one turn).
const OPENERS = ["Give me a little more.", "Closer.", "Getting there.", "One more push."];
/** A reason in their words: "because", "so", "it helps", "which means", "that way"… */
export const REASON_RE = /\b(because|since|so that|so (?:it|they|the|people|he|she|we|everyone)|cuz|cause|which (?:means|meant|lets|helps|made|makes)|that way|that's why|as a result|led to|leads to|helps?|lets|makes?|made|builds?|built|gets?|got|keeps?|kept|gives?|gave|means?|meant|works? (?:best|better) (?:when|for|because))\b/i;
/** Round 4 #2: a real answer with its reason (accepted, never re-asked for "the why"). */
export function isSolidReason(text: string): boolean {
  const t = text.trim();
  return t.split(/\s+/).filter(Boolean).length >= 10 && REASON_RE.test(t);
}
export const MORE_WORDS_NOTE = /^(Give me a little more|Closer\.|Getting there\.|One more push\.|No rush, that one doesn't count|All good, that one doesn't count)/;
/**
 * QA 8:31 AM: never the same line every time. Each try gets a different opener and
 * points at what's actually missing from what they wrote (the claim, the reason, the example).
 */
export type AskKind = "example" | "case" | "claim";
/**
 * QA prod smoke (51dddefe): what the question on screen asks for, so the nudge asks for the same
 * thing ("When did Sam Walton have to lead people through a big change…" is an example question:
 * never "Start with what you think" or "Now the why").
 */
export function askKind(question: string | null | undefined): AskKind {
  const q = String(question ?? "");
  if (/\bNow your case\b|\bNext up is your case\b|\bwhy does (?:it|that|your)\b/i.test(q)) return "case";
  if (/\bNext up is (?:your example|the change part)\b|\bWhen did\b|\breal moment\b|\bwhat did (?:they|he|she) do\b|\bwhat happened\b/i.test(q)) return "example";
  return "claim";
}

export function moreWordsNote(_have: number, _need: number, what: string, text = "", attempt = 0, kind: AskKind = "claim"): string {
  // No counts in the visible copy; keep it a nudge, not a meter.
  const opener = OPENERS[attempt % OPENERS.length]!;
  const t = text.trim();
  if (!t) return kind === "example" ? `${opener} Tell me the moment itself: when it happened and what they actually did.` : `${opener} ${what} is almost there. Add to it below.`;
  if (kind === "example") {
    // An example question gets example nudges: the moment, what they did, what happened next. Never the why.
    const when = /\b(when|in (?:19|20)\d\d|after|during|before|once|the time|year|day|week|started|opened|took over|became)\b/i.test(t);
    const did = /\b(did|led|made|told|asked|visited|listened|shared|changed|turned|cut|built|started|opened|pushed|gave|went|took|put|kept|got|called|met|moved|rallied|fired|hired)\b/i.test(t);
    const after = /\b(so|then|after that|as a result|which|that made|because of it|people|team|workers|employees|associates|staff)\b/i.test(t);
    const ask = !when
      ? "When was it? Name the moment, then what they did."
      : !did
        ? "What did they actually do in that moment? One or two things is plenty."
        : !after
          ? "What happened next: how did the people around them respond?"
          : "One more detail from that moment: what changed because of what they did?";
    return `${opener} ${ask}`;
  }
  const reason = REASON_RE.test(t);
  const example = /\b(for example|for instance|like when|such as|at [A-Z]\w+|[A-Z][a-z]+ [A-Z][a-z]+)\b/.test(t) || /\b(when (he|she|they)|did|led|changed|turned)\b/i.test(t);
  const claim = /\b(i think|i'?d argue|i want to argue|i believe|works? best|is (the )?(best|most)|better|transformational|situational|servant|democratic|task|relationship)\b/i.test(t);
  // QA 11:51 (b): a full sentence is never told to "start with one plain sentence": one ask, about what it shows.
  const sentence = t.split(/\s+/).length >= 8 && /[.!]["”]?\s*$/.test(t);
  const need = !claim && kind === "case"
    ? "Tie it to your pick: which approach shows up in that moment, and why does it work best here?"
    : !claim
    ? sentence
      ? "That's a real example. What does it show about which approach works best, and why?"
      : "Start with what you think, in one plain sentence."
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
