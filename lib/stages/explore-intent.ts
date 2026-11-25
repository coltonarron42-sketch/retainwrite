/**
 * Stage 2 listening mode (Colton, Nov 25 2026; PC-33).
 * When a student is still exploring an option, Pau listens: she
 * acknowledges, reflects, notes it, and keeps the floor open. Nothing
 * is locked and no new option menu appears until they signal they are
 * done. Coaching only: she never writes their sentences.
 */
import { wordCount } from "@/lib/utils";

/** Quote the student's words on a word boundary. Never cut a mid-word. */
function quoteOnWordBoundary(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > 24 ? cut.slice(0, boundary) : cut).trim();
}

const EXPLORE_CUE =
  /\b((let'?s |can I |could I |I want to |I'?d like to |I wanna )?(talk( it| this| that)? through|talk through|think (this |it |that )?out loud|bounce (this |it |an idea )?off you)|hear me out|listen to me|I'?m not ready( to (lock|commit|pick|decide))?|not ready to (lock|commit|pick|decide)|before I (commit|lock|decide|pick)|haven'?t decided|have not decided|still (exploring|deciding|thinking|working (it|this) out)|don'?t lock( it| that)?( in)? yet|don'?t commit|not committing|haven'?t (committed|locked)|I want to explore|can we (talk|explore)|let me (explain|finish|think)|might not belong|may not belong|not sure (if|whether) (it|this|that) belongs|haven'?t decided if it belongs)\b/i;

const DONE_CUE =
  /\b((yeah |yes |yep |ok(?:ay)? )?that'?s what I want for now|that'?s (it|enough|fine) for now|that'?s my (call|angle|idea) for now|ok(?:ay)? lock it|lock it in|let'?s lock( it)?( in)?|I'?m ready to (lock|commit|move on)|ready to lock|go with (that|this|it)|we can (lock it|move on)|I think that'?s it|that'?s the one I want)\b/i;

const LOCK_CUE = /\b(ok(?:ay)? lock it|lock it in|let'?s lock( it)?( in)?|ready to lock|I'?m ready to (lock|commit))\b/i;

/** "Talk through / hear me out / not ready / before I commit" — stay in listening mode. */
export function isExploreIntent(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return EXPLORE_CUE.test(t);
}

/** Still exploring: "not ready to lock" must never count as a done/lock cue. */
function isExploreHold(text: string): boolean {
  return /\b(not ready|don'?t lock|before I (lock|commit|decide)|haven'?t (locked|committed|decided)|hear me out|talk through)\b/i.test(text);
}

/** "Yeah that's what I want for now", "ok lock it", and close cousins. */
export function isExploreDone(text: string, lastPau = ""): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (isExploreHold(t)) return false;
  if (DONE_CUE.test(t)) return true;
  const invited = /\b(what you want for now|whenever you'?re ready|tell me when that'?s)\b/i.test(lastPau);
  if (invited && /^(y(es|ep|eah|up)?|sure|ok(ay)?|that'?s it|go ahead|do it)[.!\s]*$/i.test(t)) return true;
  return false;
}

/** A clear "lock this in" said while leaving listening mode. */
export function isExploreLock(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t || isExploreHold(t)) return false;
  return LOCK_CUE.test(t);
}

const TALK_THROUGH =
  /\btalk(?: it| this| that)? through\s+(?:the |this |that |my )?(.+?)(?:\s+(?:a bit|a little|with you|here|first|before|because|but|and|—|–|\.\.\.|…)|[.?!]|$)/i;
const NAMED_IDEA =
  /\b(?:the |this |that |my )?((?:[A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*){0,3}|counter-?arguments?|comparisons?|examples?|angles?|ideas?|leads?)(?:\s+(?:idea|comparison|example|angle|lead|option|point))?)\b/;

/** A short topic phrase from their words, or null. */
export function exploreTopic(text: string): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const through = t.match(TALK_THROUGH);
  const raw = (through?.[1] ?? "").trim();
  if (raw && wordCount(raw) <= 8) return cleanTopic(raw);
  const named = t.match(NAMED_IDEA);
  if (named?.[1] && !/^(idea|this|that|it)$/i.test(named[1])) return cleanTopic(named[1]);
  return null;
}

function cleanTopic(s: string): string {
  const t = s.replace(/[“”"']+$/g, "").replace(/^[“”"']+/g, "").trim();
  if (!t) return t;
  return t.charAt(0).toLowerCase() === t.charAt(0) ? t : t;
}

/**
 * Substance to note on the section: their words minus the "talk through"
 * wrapper. A bare request to talk is not a note.
 */
export function exploreNote(text: string): string | null {
  let t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  t = t
    .replace(/^(?:(?:ok(?:ay)?|so|um+|uh+|well|hey)[,.!\s]+)*/i, "")
    .replace(/^(?:can I |could I |I want to |I'?d like to |let me |let's )?(?:talk(?: it| this| that)? through|hear me out|think (?:this |it )?out loud)\s*(?:the |this |that |my )?/i, "")
    .replace(/\b(?:a bit |a little )?(?:before I (?:commit|lock(?: it)?(?: in)?|decide)|I'?m not ready to lock(?: that)? in|haven'?t decided if it belongs)\b/gi, "")
    .replace(/^[,.\s—–…-]+/, "")
    .replace(/[,.\s—–…-]+$/, "")
    .trim();
  if (wordCount(t) < 5) return null;
  if (isExploreIntent(t) && wordCount(t) < 12) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Acknowledge, reflect in 1–2 sentences, keep the floor open. At most one light question. */
export function exploreReply(text: string, sectionTitle: string): string {
  const part = (sectionTitle || "this section").toLowerCase();
  const topic = exploreTopic(text);
  const note = exploreNote(text);
  const reflected = note ? quoteOnWordBoundary(note, 110) : "";
  const about = topic ? ` ${topic}` : " this";
  const ack = `Got it — you want to talk through${about} before anything gets locked in your ${part}.`;
  const hold = reflected
    ? ` I'm hearing “${reflected}.” I'll note it for this section.`
    : ` I'll note it for this section and keep this open.`;
  const floor = ` I'm here if you want to keep going, or tell me when that's what you want for now.`;
  const ask = !reflected && !topic ? ` What's the one piece of this you want me to hold onto?` : "";
  return `${ack}${hold}${floor}${ask}`.replace(/\s+/g, " ").trim();
}

/** First-tap recap before "Keep my angle" actually advances. */
export function keepAngleSummary(note: string, title: string): string {
  const part = (title || "this section").toLowerCase();
  const claim = quoteOnWordBoundary((note ?? "").replace(/\s+/g, " ").trim(), 140);
  if (claim) {
    return `Just to confirm before we leave your ${part}: you want to keep this angle — “${claim}.” Tap below if that's right, or tell me what to change.`;
  }
  return `Just to confirm before we leave your ${part}: you want to keep the angle you already have. Tap below if that's right, or tell me what to change.`;
}

const GENERIC_PRESSURE = /^a reasonable reader could see this another way\.?$/i;

/**
 * Pressure-test copy that quotes the student's claim and names a specific
 * counterpoint. Never the generic "another way" line alone.
 */
export function pressureTestLine(input: {
  claim?: string | null;
  reason?: string | null;
  counterpoint?: string | null;
}): string {
  const claim = quoteOnWordBoundary((input.claim ?? "").replace(/\s+/g, " ").trim(), 120);
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim();
  const specificReason = reason && !GENERIC_PRESSURE.test(reason) ? (/[.!?]$/.test(reason) ? reason : `${reason}.`) : "";
  const counter = asCounterpoint(input.counterpoint);
  if (claim && counter) return `You said “${claim}.” A reasonable reader might counter that ${counter}.`;
  if (claim && specificReason) return `You said “${claim}.” ${specificReason}`;
  if (claim) return `You said “${claim}.” A reasonable reader might push back on that claim — what would they say first?`;
  if (specificReason) return specificReason;
  if (counter) return `A reasonable reader might counter that ${counter}.`;
  return "A reasonable reader might push back on this claim. What would they say first?";
}

export function isGenericPressureReason(reason: string | null | undefined): boolean {
  return GENERIC_PRESSURE.test((reason ?? "").replace(/\s+/g, " ").trim());
}

/** Turn an alternative-angle question into a counterpoint clause. */
export function asCounterpoint(raw: string | null | undefined): string {
  let t = (raw ?? "").replace(/\s+/g, " ").trim().replace(/\?+$/, "");
  if (!t) return "";
  t = t
    .replace(/^(what|which|how|why|where|who)\b/i, "")
    .replace(/^\s*(part of the assignment makes you most sure|would someone who disagrees say)\b/i, "")
    .replace(/^(would|could|should)\b/i, "")
    .replace(/^[,:\s]+/, "")
    .trim();
  if (!t || wordCount(t) < 3) {
    const original = (raw ?? "").replace(/\s+/g, " ").trim().replace(/\?+$/, "");
    return original && !/^(what|which|how|why)\b/i.test(original) ? uncap(original) : "";
  }
  return uncap(t);
}

function uncap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export type ListeningState = { topic: string; notes: string[] };

/** Directions on screen: a short list, never a list plus a stretch. */
export function oneOptionLeadBatch<T extends { ranked: unknown[]; wildcard: unknown | null }>(batch: T, cap = 3): T {
  const ranked = batch.ranked.slice(0, cap);
  if (ranked.length > 0) return { ...batch, ranked, wildcard: null };
  return { ...batch, ranked };
}
