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
  /** Example leaders (or examples) to offer while teaching (Colton 12:08). */
  people?: DecisionOption[];
  /** The core idea in plain words, taught first when they're confused. */
  concept?: string | null;
  /** QA 1:16: the recommendation stays put between turns; it only moves on after a "no". */
  recIndex?: number;
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
  const rec = opts[(input.recIndex ?? 0) % opts.length]!;
  const concept = (input.unread ? scrubUnreadRefs(input.concept ?? "") : input.concept ?? "").trim();
  const intro = input.confused
    ? `That's okay, that's why you're here! ${concept ? `${concept} ` : ""}Here's the short version of the ${what}:`
    : step === 0
      ? `Let me make this easier. The short version of the ${what}:`
      : `Another way to look at it:`;
  const lines = opts.map((o) => `• ${o.label}: ${o.why ? plain(o.why) : "a real, well-known choice"}.`);
  const recLine = `A lot of students in your spot start with ${rec.label} because it's the easiest one to show with one real example${rec.why ? ` (${plain(rec.why)})` : ""}.`;
  const ask = `Want to start with ${rec.label}? Say yes or no, and a few words on why.${offerCatchUp ? " Or I can catch you up on the reading first." : ""}`;
  const ppl = (input.people ?? []).filter((p) => p.label !== rec.label).slice(0, 3);
  const exLine = input.kind !== "leader" && ppl.length
    ? `Leaders people often write about here: ${ppl.map((p) => `${p.label}${p.why ? ` (${plain(input.unread ? scrubUnreadRefs(p.why) : p.why)})` : ""}`).join("; ")}.`
    : null;
  let paras = [intro, ...lines, ...(exLine && step <= 1 ? [exLine] : []), `${recLine} ${ask}`];
  if (paras.join("\n") === input.last) paras = [`Okay, a different angle.`, ...lines, `${recLine} ${ask}`];
  return { paras, recommend: rec, offerCatchUp };
}

/* ------------------- Colton 12:08: diagnose first, then branch ------------------- */

/** The first question after the confirm: what's really asked, in plain words, then where they are. */
export function diagnoseQuestion(ask: string | null | undefined): string {
  const plainAsk = (ask ?? "").trim().replace(/\s+/g, " ").replace(/[.!?\s]+$/, "");
  const lead = plainAsk ? `So, in plain words: ${plainAsk.replace(/^./, (c) => c.toUpperCase())}. ` : "";
  return `${lead}Where are you with it? If you already have ideas (an example, a direction, a rough flow), tell me what you've got. If you're not sure where to start or haven't read the course material yet, just say so, and we'll start there.`;
}

const NOT_NAME =
  /^(?:I|I'm|I've|The|This|That|My|Our|Chapter|Northouse|Goleman|Leadership|Theory|Practice|What|Makes|Leader|HBR|APA|MLA|Prof|Professor|Dr|Ms|Mr|Mrs|Using|Because|And|But|So|Transformational|Situational|Servant|Behavioral|Authentic|Emotional|Intelligence|Harvard|Business|Review|Quiet|Kitchen|Long|Table|Memory|Under|Pressure|Monday|Tuesday|Wednesday|Thursday|Friday|December|November|January)$/;
/** A real person named in their words ("Sam Walton"), or null. */
export function namedPerson(text: string): string | null {
  for (const m of text.matchAll(/\b([A-Z][a-z'’-]{1,})\s+([A-Z][a-z'’-]{2,})(?:\s+([A-Z][a-z'’-]{2,}))?\b/g)) {
    if (NOT_NAME.test(m[1]!) || NOT_NAME.test(m[2]!)) continue;
    return [m[1], m[2], m[3]].filter(Boolean).join(" ");
  }
  return null;
}

const IDEA_CUE =
  /\b(?:i want|i'?d like|i think|i'?m thinking|i was thinking|my idea|i plan|i'?m planning|i'?m going|i have (?:an idea|a few ideas|some ideas)|i'?d (?:use|argue|pick|go with|write)|i'?ll (?:use|argue|write)|i (?:could|would) (?:use|argue|write)|argue|my example|using)\b/i;
/**
 * INFORMED (Colton 12:08): they already have ideas (a leader, a style, an example, a flow).
 * Their words are kept word for word; the leader is pulled out when there is one.
 */
export function informedSaying(text: string, options: DecisionOption[] = []): { stance: string; leader: string | null } | null {
  const t = norm(text);
  if (!t || isUnsureReadSaying(t) || isAmbiguousReply(t) || isConfusedSaying(t)) return null;
  const words = t.split(" ").length;
  const person = namedPerson(t);
  const lower = t.toLowerCase();
  const option = options.some((o) =>
    o.label
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 4 && !/^(leadership|style|styles|approach|focus|option)$/.test(w))
      .some((w) => lower.includes(w)),
  );
  const idea = IDEA_CUE.test(t);
  if ((person && (idea || words >= 4)) || (option && idea) || (idea && words >= 12)) return { stance: t, leader: person };
  return null;
}

const STYLE_STOP = /^(?:the|a|an|of|his|her|their|my|our|good|great|best|which|what|this|that|real|strong|effective|most|team|i|he|she|they|shows|show|both|any|some|every|one|two|different|kind|type|whole|bad|better|use|using)$/i;
/** The styles or approaches named in their words ("servant and transformational leadership"). */
export function stylesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b([a-z-]+(?:(?:\s*,\s*|\s+and\s+|\s+or\s+|\s*&\s*)[a-z-]+)*)\s+(?:leadership|styles?)\b/gi)) {
    for (const w of m[1]!.split(/\s*,\s*|\s+and\s+|\s+or\s+|\s*&\s*/)) {
      const x = w.trim().toLowerCase();
      if (x.length > 3 && !STYLE_STOP.test(x) && !out.includes(x)) out.push(x);
    }
  }
  return out;
}

const listJoin = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * INFORMED (Colton 12:08, QA 1:16): affirm by name, lock in what they gave word for word, show the
 * assignment's checklist (covered vs. next), then the next requirement as one concrete question.
 */
export function informedAffirm(
  stance: string,
  ctx: { leader?: string | null; mustInclude?: string[]; needsPerson?: boolean } = {},
): string[] {
  const styles = stylesIn(stance);
  const leader = ctx.leader?.trim() || null;
  const named = leader && styles.length ? `${leader}, showing ${listJoin(styles)} leadership` : leader ? leader : styles.length ? `${listJoin(styles)} leadership` : null;
  const paras = [
    `Awesome, sounds like you have a good idea of what this paper needs${named ? `: ${named}` : ""}. I'll help with source material, structure and hitting every requirement.`,
    `Locked in, in your words: “${stance.replace(/[“”"]/g, "'")}”. We can expand on it later.`,
  ];
  const lines = requirementLines(stance, { leader, styles, mustInclude: ctx.mustInclude ?? [], needsPerson: ctx.needsPerson });
  if (lines.length) paras.push("Here's the assignment's checklist, so you can see what's covered and what's next:", ...lines);
  return paras;
}

/** The assignment's requirements as checklist lines: ✓ covered by what they said, ○ still to do. */
export function requirementLines(
  stance: string,
  ctx: { leader: string | null; styles: string[]; mustInclude: string[]; needsPerson?: boolean },
): string[] {
  const lines: string[] = [];
  if (ctx.needsPerson || ctx.leader) lines.push(ctx.leader ? `✓ A real leader as your example: ${ctx.leader}.` : "○ A real leader as your example.");
  if (ctx.styles.length) lines.push(`✓ Your style${ctx.styles.length > 1 ? "s" : ""}: ${listJoin(ctx.styles)}.`);
  lines.push("○ Your case for why it answers the assignment's question. That's next.");
  const said = stance.toLowerCase();
  for (const raw of ctx.mustInclude.slice(0, 5)) {
    const item = raw.replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, "");
    if (!item || /\b(real leader|one leader|leader as|example)\b/i.test(item) && (ctx.needsPerson || ctx.leader)) continue;
    const marks = (item.match(/\b[A-Z][a-z]{3,}\b/g) ?? []).filter((w) => !/^(Chapter|Theory|Practice|Leadership|What|Makes|Leader|Article|Format)$/.test(w));
    const covered = marks.some((w) => said.includes(w.toLowerCase()));
    const format = /\b(words?|APA|MLA|Chicago|format|pages?|double|font|due)\b/i.test(item);
    lines.push(covered ? `✓ ${item}: you've read it.` : format ? `○ ${item}. We'll handle it when you draft.` : `○ ${item}. I'll help you with this one.`);
  }
  return lines;
}

/** INFORMED: the next requirement, as one concrete question built from what they gave. */
/** QA 1:16: the informed student's next requirement on the story step: one concrete question about their own example. */
export function informedStoryAsk(leader: string | null): string {
  if (leader) return `Next up is your example. When did ${leader} have to lead people through a big change, and what did they do? Two or three sentences, rough is fine.`;
  return "Next up is your example. What's one real moment that shows your idea in action, and what happened? Two or three sentences, rough is fine.";
}

export function informedNext(stance: string, leader: string | null, afterStory = false): string {
  const styles = stylesIn(stance);
  if (afterStory && styles.length)
    return `Now your case: how did ${listJoin(styles)} leadership show up in that moment, and why does it work best for this assignment? A few sentences is your early take, rough is fine.`;
  if (afterStory) return "Now your case: why does that moment answer the assignment's question? A few sentences is your early take, rough is fine.";
  if (leader && styles.length)
    return `Next up is the change part. When did ${leader} have to lead people through a big change, and how did ${listJoin(styles)} leadership show up in it? A few sentences is your early take, rough is fine.`;
  if (leader) return `Next up is your case. What did ${leader} actually do that answers the assignment's question? A few sentences is your early take, rough is fine.`;
  return "Next up is your case. In a few sentences, why does your idea answer the assignment's question? That's your early take, rough is fine.";
}

/** LOST: reassure, teach the core idea in plain words, then the catch-up from the professor's sources. */
export function lostLead(input: { concept?: string | null; ask?: string | null; hasSummary?: boolean }): string {
  const concept = (input.concept ?? "").trim();
  const ask = (input.ask ?? "").trim().replace(/[.!?\s]+$/, "");
  const core = concept || (ask ? `The core of it: ${ask.replace(/^./, (c) => c.toLowerCase())}.` : "");
  const tail =
    input.hasSummary === false
      ? "I don't have your professor's sources yet, so here's what I need to give you a real summary of them."
      : "Here's a summary of the key ideas from your professor's sources so you get a better grasp.";
  return `That's okay, that's why you're here! ${core ? `${core} ` : ""}${tail}`.replace(/\s+/g, " ").trim();
}
