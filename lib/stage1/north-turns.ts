/**
 * QA 11:40 (preview retest): typed read-question replies, vague-pick escalation,
 * confusion, and no references to material the student hasn't read.
 * SOP: coaching only. Nothing here writes paper text.
 */
import type { DecisionOption } from "./paper-context";

const norm = (t: string) => t.replace(/\s+/g, " ").trim();

/** "idk", "not sure", "no clue", "haven't read": a typed not-read/unsure answer to "Have you read it?". */
const UNSURE_READ =
  /^(?:\s*(?:um+|uh+|hmm+|honestly|tbh|well)[, ]*)?(?:idk|i\s*d\s*k|dunno|i (?:don'?t|do not) know|not sure|unsure|no clue|no idea|not really|not yet|nope|no|nah|kinda|sort of|a little|barely|some of it|skimmed(?: it)?|i skimmed)\b|\b(?:haven'?t|have not|didn'?t|did not|never) (?:read|finished|started|looked at|opened|gotten to)\b|\bnot (?:read|done|finished) (?:it|anything|the|yet)\b/i;
export function isUnsureReadSaying(text: string): boolean {
  const t = norm(text);
  return t.length > 0 && t.length <= 300 && UNSURE_READ.test(t);
}

/** "sure", "ok": ambiguous; the catch-up is offered as a one-tap yes, never skipped past. */
const AMBIG = /^(?:sure|ok(?:ay)?|k|kk|alright|all right|fine|cool|yes please|sure thing|go ahead|maybe|i guess|sounds good)[.!]*$/i;
export function isAmbiguousReply(text: string): boolean {
  return AMBIG.test(norm(text));
}

/** "no clue what a leader is supposed to do", "what's the difference?": explicit confusion. */
const CONFUSED =
  /\b(?:no (?:clue|idea)|(?:don'?t|do not) (?:know|get|understand) (?:what|how|which|the difference|any of)|what(?:'s| is) the difference|what (?:is|are|does) (?:a |an |the )?[\w ]{2,40}(?:supposed to|mean|even)|i'?m (?:so )?(?:lost|confused)|confused|makes no sense|huh)\b/i;
export function isConfusedSaying(text: string): boolean {
  const t = norm(text);
  return t.length > 0 && t.length <= 300 && CONFUSED.test(t);
}

const YES = /^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|sounds good|let'?s do (?:it|that)|that works|i'?ll (?:go with|take|start with) (?:that|it|this))\b/i;
const NO = /^(?:no|nah|nope|not really|i'?d rather not|i don'?t (?:like|want))\b/i;
export const isYesSaying = (t: string) => YES.test(norm(t)) && !NO.test(norm(t));
export const isNoSaying = (t: string) => NO.test(norm(t));

/** Text that points at assigned material ("the leader in the HBR article", "chapter 4"). */
const MATERIAL_REF =
  /\b(?:HBR|Harvard Business Review|the (?:assigned |required )?(?:article|reading|readings|chapter|chapters|textbook|book|excerpt|case study|piece|packet|course packet|handout)|your (?:article|reading|readings|chapter|textbook|book)|(?:chapter|ch\.?) ?\d+|Northouse|Goleman)\b/i;
export function refsUnreadMaterial(text: string): boolean {
  return MATERIAL_REF.test(text);
}

/** The same text with material references swapped for neutral ones (for a student who hasn't read it). */
export function scrubUnreadRefs(text: string): string {
  return text
    .replace(/\s*\([^()]*\)/g, (m) => (MATERIAL_REF.test(m) ? "" : m))
    .replace(/\b(?:the )?(?:leader|person|example|CEO) (?:in|from|described in|discussed in) (?:the |your )?[\w' ]{0,40}?(?:article|reading|chapter|book|textbook|excerpt|piece|case study)\b/gi, "a real leader")
    .replace(/,?\s*\b(?:as|like) (?:described|discussed|shown|covered) in [^,.;?]*?(?:article|reading|chapter|book|textbook|HBR|Harvard Business Review)[^,.;?]*/gi, "")
    .replace(/,?\s*\b(?:in|from|per|according to) (?:the |your |this )?(?:assigned |required )?[\w' ]{0,40}?(?:article|reading|readings|chapter|textbook|book|excerpt|piece|packet|handout|HBR|Harvard Business Review)(?: \d+)?\b/gi, "")
    .replace(/\b(?:HBR|Harvard Business Review|Northouse|Goleman)(?:'s)?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;?!])/g, "$1")
    .trim();
}

const plain = (s: string) => s.replace(/[.!?\s]+$/, "").replace(/^./, (c) => c.toLowerCase());

/**
 * A vague or confused reply at a pick question. Round 1 (not confused): name the options and ask.
 * From round 2 (or right away when confused): teach the differences in 2-3 plain lines, recommend
 * one as a starting point with a reason, and ask yes or no plus why. Never the same text twice in a row.
 */
export function pickEscalation(input: {
  options: DecisionOption[];
  round: number;
  confused?: boolean;
  last?: string | null;
  unread?: boolean;
  catchUpSkipped?: boolean;
  kind?: "style" | "leader";
}): { paras: string[]; recommend: DecisionOption | null; offerCatchUp: boolean } {
  const opts = input.options.slice(0, 3).map((o) => ({ ...o, why: input.unread ? scrubUnreadRefs(o.why) : o.why }));
  const what = input.kind === "leader" ? "leaders" : "options";
  const offerCatchUp = Boolean(input.catchUpSkipped);
  if (!opts.length) {
    const paras = [
      input.round <= 1 && !input.confused
        ? "Which one do you mean? Name it in your own words and say why. One sentence is plenty."
        : "No problem, this is the part where most people get stuck. Pick the direction you'd find easiest to explain to a friend, and tell me why in a sentence.",
    ];
    if (paras[0] === input.last) paras[0] = "Say it rough: which way are you leaning, and what makes it appeal to you?";
    return { paras, recommend: null, offerCatchUp };
  }
  if (input.round <= 1 && !input.confused) {
    let ask = `Which one are you leaning toward (${opts.map((o) => o.label).join(", ")}), and why? One sentence is plenty.`;
    if (ask === input.last) ask = `Say it rough: ${opts.map((o) => o.label).join(" or ")}? And what makes it appeal to you?`;
    return { paras: [ask], recommend: null, offerCatchUp };
  }
  const step = Math.max(0, input.round - 2);
  const rec = opts[step % opts.length]!;
  const intro = input.confused
    ? `Fair question. Here's the short version of the ${what}:`
    : step === 0
      ? `Let me make this easier. The short version of the ${what}:`
      : `Another way to look at it:`;
  const lines = opts.map((o) => `• ${o.label}: ${o.why ? plain(o.why) : "a real, well-known choice"}.`);
  const recLine = `A lot of students in your spot start with ${rec.label} because it's the easiest one to show with one real example${rec.why ? ` (${plain(rec.why)})` : ""}.`;
  const ask = `Want to start with ${rec.label}? Say yes or no, and a few words on why.${offerCatchUp ? " Or I can catch you up on the reading first." : ""}`;
  let paras = [intro, ...lines, `${recLine} ${ask}`];
  if (paras.join("\n") === input.last) paras = [`Okay, a different angle.`, ...lines, `${recLine} ${ask}`];
  return { paras, recommend: rec, offerCatchUp };
}
