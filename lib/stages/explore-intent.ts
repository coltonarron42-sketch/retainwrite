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

/**
 * A clean noun phrase for the acknowledgement ("the counterargument idea"),
 * or null when there isn't one. Never a leftover cue ("I'm", "it", "this").
 */
export function exploreTopic(text: string): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const cuts = [
    t.match(/\btalk(?:\s+(?:it|this|that))?\s+through\s+(.+)/i)?.[1],
    t.match(/\bthink\s+(?:this\s+|it\s+)?out\s+loud\s+about\s+(.+)/i)?.[1],
    t.match(/\bbounce\s+(.+?)\s+off you\b/i)?.[1],
    t.match(/\b(?:haven'?t decided if|not sure if)\s+(.+?)\s+belongs\b/i)?.[1],
    t.match(/\btalk about\s+(.+)/i)?.[1],
  ];
  for (const raw of cuts) {
    const phrase = nounPhraseFrom(raw);
    if (phrase) return phrase;
  }
  const det = nounPhraseFrom(t.match(/\b((?:the|a|an)\s+[A-Za-z][\w'&-]*(?:\s+[A-Za-z][\w'&-]*){0,4})\b/)?.[1]);
  return det && isTopicalPhrase(det) ? det : null;
}

/** Cut at punctuation or a trailing cue, then require a real noun phrase with an article. */
function nounPhraseFrom(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, " ").trim();
  const tail = s.search(/(?:\s*(?:[.?!…]+|\.{2,})\s*|\s+[—–-]+\s+|\s+(?:a bit|a little|with you|here|first|before|because|but|and|or|so)\b|,)/i);
  if (tail > 0) s = s.slice(0, tail);
  s = s.replace(/^[,.\s"“”'’—–…-]+/, "").replace(/[,.\s"“”'’—–…-]+$/, "").trim();
  if (!s) return null;
  const had = s.match(/^(the|a|an|this|that|my)\s+(.+)$/i);
  let article = had?.[1]?.toLowerCase() ?? null;
  let rest = had ? had[2]! : s;
  const words = rest.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 6) return null;
  if (words.some(isCueWord) || /^(idea|thing|it)$/i.test(rest)) return null;
  rest = words.map(tidyTopicWord).join(" ");
  if (article === "my" || article === "this" || article === "that") article = "the";
  if (article === "a" || article === "an") {
    article = startsWithVowelSound(words[0]!) ? "an" : "a";
  }
  if (!article) {
    article = startsWithVowelSound(words[0]!) && !/^[A-Z]/.test(words[0]!) ? "an" : "the";
  }
  return `${article} ${rest}`;
}

const COMMON_TOPIC = /^(counter-?arguments?|comparisons?|examples?|angles?|ideas?|leads?|options?|points?|rebuttals?|views?|opposing|second)$/i;
const CUE_WORD = /^(i|i'?m|i'?d|i'?ve|i'?ll|you|we|he|she|they|it|this|that|not|ready|lock|commit|decide|hear|out|me|us)$/i;

function isCueWord(w: string): boolean {
  return CUE_WORD.test(w.replace(/[^a-zA-Z'’-]/g, ""));
}

function tidyTopicWord(w: string): string {
  return COMMON_TOPIC.test(w) ? w.toLowerCase() : w;
}

function startsWithVowelSound(w: string): boolean {
  return /^[aeiou]/i.test(w.replace(/[^a-zA-Z]/g, ""));
}

const WEAK_SINGLE = /^(bit|little|lot|while|moment|time|now|first|here|there|way|stuff|thing|one|part|section)$/i;
const TOPIC_NOUN = /^(counter-?arguments?|comparisons?|examples?|angles?|ideas?|leads?|options?|points?|rebuttals?|views?)$/i;

function isTopicalPhrase(phrase: string): boolean {
  const rest = phrase.replace(/^(the|a|an)\s+/i, "");
  const words = rest.split(/\s+/).filter(Boolean);
  if (!words.length || (words.length === 1 && WEAK_SINGLE.test(words[0]!))) return false;
  if (words.length >= 2) return true;
  return TOPIC_NOUN.test(rest) || /^[A-Z][a-zA-Z'&-]+$/.test(words[0]!);
}

/**
 * Closing / confirm phrases ("yeah that's what I want for now", "ok lock it")
 * must never be saved as notes or claims.
 */
export function isClosingPhrase(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t || isExploreHold(t)) return false;
  if (isExploreDone(t)) return true;
  return /^(yeah|yes|yep|yup|sure|ok(?:ay)?)[,.\s]*(that'?s (what I want|it|enough|fine|my (call|angle|idea))( for now)?)?[.!\s]*$/i.test(t);
}

/** Leftover cue scraps like "Costco comparison a bit? I." are not notes. */
export function isNoteFragment(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (isClosingPhrase(t)) return true;
  if (/[—–,:;]$/.test(t)) return true;
  if (/\b(I|I'?m|I'?d|I'?ve|the|a|an|to|and|or|but|if|my)$/i.test(t.replace(/[.?!…]+$/, ""))) return true;
  if (wordCount(t) < 5) return true;
  if (/^(the |a |an )?(counter-?argument idea|costco comparison|walton angle)\s*(a bit|a little)?\??$/i.test(t)) return true;
  return false;
}

function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  return (t.match(/[^.!?…]+(?:[.!?…]+|$)/g) ?? [t]).map((s) => s.trim()).filter(Boolean);
}

const LEAD_IN =
  /^(?:(?:well|so|um+|uh+|hmm+|ooh+|honestly|look|like)\s+)*(?:hear me out\b[:\s,.!—–…-]*|(?:I think|I feel(?: like)?|I believe|I guess)(?: that)?\s+|maybe\s+|perhaps\s+|possibly\s+)/i;

/** Strip colons, "maybe", "hear me out", "I think", and similar lead-ins. */
export function stripLeadIns(text: string): string {
  let t = (text ?? "").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*;:\s*/g, " ").replace(/;:/g, " ");
  t = t.replace(/^[:;,\s—–…-]+/, "");
  for (let i = 0; i < 4; i++) {
    const next = t.replace(LEAD_IN, "").replace(/^[:;,\s—–…-]+/, "").trim();
    if (next === t) break;
    t = next;
  }
  return t.replace(/\s{2,}/g, " ").trim();
}

function stripExploreWrapper(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t
    .replace(/^(?:(?:ok(?:ay)?|so|um+|uh+|well|hey|hmm+|ooh+|honestly)[,.!\s:]*)+/i, "")
    .replace(/^(?:can I |could I |I want to |I'?d like to |let me |let's )?(?:talk(?: it| this| that)? through|hear me out|think (?:this |it )?out loud)\s*(?:the |this |that |my )?/i, "")
    .replace(/^(?:I'?m not ready to lock(?: that)? in|hear me out)\b[,.\s—–:…]*/i, "")
    .replace(/\b(?:a bit |a little )?(?:before I (?:commit|lock(?: it)?(?: in)?|decide)|I'?m not ready to lock(?: that)? in|haven'?t decided if it belongs)\b/gi, "")
    .replace(/^[,.\s—–…-]+/, "")
    .replace(/[,.\s—–…-]+$/, "")
    .trim();
  return stripLeadIns(t);
}

/** Model or fallback copy that still has join artifacts or leftover lead-ins. */
export function isMessyListenCopy(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/;:|\s*;\s*:|that:\s|idea that:/.test(t)) return true;
  if (/\bhear me out\b/i.test(t)) return true;
  if (/you're sitting with the idea that/i.test(t)) return true;
  return false;
}

/**
 * Substance to note on the section: their words minus the "talk through"
 * wrapper. A bare request, confirm phrase, or leftover fragment is not a note.
 */
export function exploreNote(text: string): string | null {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw || isClosingPhrase(raw)) return null;
  const kept: string[] = [];
  for (const sentence of splitSentences(raw)) {
    if (isClosingPhrase(sentence)) continue;
    const t = stripExploreWrapper(sentence);
    if (!t) continue;
    if (isClosingPhrase(t) || isNoteFragment(t)) continue;
    if (isExploreIntent(t) && wordCount(t) < 12) continue;
    kept.push(t.charAt(0).toUpperCase() + t.slice(1));
  }
  if (!kept.length) return null;
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function finishSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

function lowerFirst(text: string): string {
  const t = text.trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/** Deterministic paraphrase in Pau's words. Never a verbatim quote, never mid-sentence. */
export function fallbackParaphrase(note: string): string {
  let t = stripLeadIns(note.replace(/\s+/g, " ").trim());
  const lessPress = t.match(/^(.+?)\s+just get(?:s)? less press\.?$/i);
  if (lessPress || /just get(?:s)? less press/i.test(t)) {
    const whoRaw = (lessPress?.[1] ?? t.replace(/\s+just get(?:s)? less press\.?$/i, "")).trim() || "they";
    const who = lowerFirst(stripLeadIns(whoRaw).replace(/^that\s+/i, "")) || "they";
    return finishSentence(`So your hunch is that ${who} just don't get as much press`);
  }
  if (/^I'?m not sure(?: yet)? if\s+/i.test(t) || /should hint that/i.test(t)) {
    t = t.replace(/^I'?m not sure(?: yet)? if\s+/i, "");
    t = t.replace(/\bthe intro\b/gi, "the introduction");
    const hinted = t.match(/hint that\s+(.+)/i);
    if (hinted) {
      return finishSentence(`You're still weighing whether the introduction should hint that ${lowerFirst(hinted[1]!.replace(/[.]+$/, ""))}`);
    }
  }
  t = t.replace(/^I'?m not sure(?: yet)? if\s+/i, "");
  t = t.replace(/^I'?m not sure(?: yet)?\s+/i, "");
  t = t.replace(/^I don't know if\s+/i, "");
  t = t.replace(/^I think\s+/i, "");
  t = t.replace(/^I wonder(?: if)?\s+/i, "");
  t = t.replace(/\bthe intro\b/gi, "the introduction");
  t = t.replace(/\bhint that\.$/i, "hint at that.");
  return finishSentence(`So your hunch is that ${lowerFirst(t)}`);
}

function specificFollowUp(note: string): string {
  if (/less press/i.test(note)) return "Want to unpack why they get less press, or keep going?";
  if (/not sure|unsure|weighing|hint/i.test(note)) return "What would that hint sound like, in one line?";
  if (/costco/i.test(note)) return "What about Costco feels like it might belong?";
  return "Want to sit with that a bit more, or add another piece?";
}

/**
 * Acknowledge, then summarize in Pau's own words. Never quote raw student text,
 * never truncate mid-sentence. At most one light, specific follow-up.
 */
export function exploreReply(text: string, sectionTitle: string): string {
  const part = (sectionTitle || "this section").toLowerCase();
  const topic = exploreTopic(text);
  const note = exploreNote(text);
  const ack = topic
    ? `Got it — you want to talk through ${topic} before anything gets locked in your ${part}.`
    : "Got it, let's talk it through before anything gets locked.";
  if (note) {
    const follow = specificFollowUp(note);
    return `${ack} ${fallbackParaphrase(note)} ${follow}`.replace(/\s+/g, " ").trim();
  }
  return `${ack} I'll note it for this section and keep this open. I'm here if you want to keep going, or tell me when that's what you want for now.`.replace(/\s+/g, " ").trim();
}

const GENERIC_HOLD_Q = /what'?s the one piece of this you want me to hold onto/i;

/** Accept a model listen reply, or fall back if it quotes, truncates, or is messy. */
export function parseListenModelReply(raw: string, fallback: string): string {
  let text = (raw ?? "").trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { reply?: unknown; text?: unknown };
    const picked = parsed.reply ?? parsed.text;
    if (typeof picked === "string" && picked.trim()) text = picked.trim();
  } catch {
    /* plain text is fine */
  }
  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 12) return fallback;
  if (/I'?m hearing\s*[“"']/.test(text) || /“[^”]{0,200}$/.test(text)) return fallback;
  if (isMessyListenCopy(text)) return fallback;
  if ((text.match(/\?/g) ?? []).length > 1) return fallback;
  if (GENERIC_HOLD_Q.test(text)) text = text.replace(GENERIC_HOLD_Q, "").replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences?.length) text = sentences.slice(0, 3).join(" ").trim();
  else text = finishSentence(text);
  if (!text || isMessyListenCopy(text)) return fallback;
  return text;
}

function shapeClaimBit(note: string): string {
  let t = stripLeadIns(note.replace(/\s+/g, " ").trim());
  t = t.replace(/^I'?m not sure(?: yet)? if\s+/i, "");
  t = t.replace(/^(?:the )?(?:intro(?:duction)?|this section) (?:should|could) hint that\s+/i, "");
  t = t.replace(/^the introduction could hint that\s+/i, "");
  t = t.replace(/\bjust get less press\b/i, "get less press");
  t = t.replace(/\bget more credit\b/i, "get more of the credit");
  t = t.replace(/[.]+$/, "").trim();
  return t;
}

function frameIntroHint(bit: string, sectionTitle: string, original: string): string {
  const core = bit.replace(/^your intro hints that\s+/i, "").replace(/[.]+$/, "").trim();
  if (!core) return bit.replace(/[.]+$/, "");
  if (/^your intro hints that/i.test(bit)) return `Your intro hints that ${lowerFirst(core)}`;
  const looksLikeHint =
    /(?:intro(?:duction)?).*(?:hint)|(?:should|could)\s+hint/i.test(original) || /intro/i.test(sectionTitle);
  if (looksLikeHint) return `Your intro hints that ${lowerFirst(core)}`;
  return core;
}

/**
 * Synthesize the locked note / pressure-tested claim from listening turns.
 * Confirm phrases and fragments are ignored. One clean sentence in Pau's words.
 */
export function listeningClaim(notes: string[], sectionTitle = ""): string | null {
  const bits: string[] = [];
  const originals: string[] = [];
  const seen = new Set<string>();
  for (const raw of notes) {
    if (!raw || isClosingPhrase(raw)) continue;
    const note = exploreNote(raw) ?? (isNoteFragment(raw) || isExploreIntent(raw) ? null : raw.replace(/\s+/g, " ").trim());
    if (!note || isClosingPhrase(note) || isNoteFragment(note)) continue;
    const bit = shapeClaimBit(note);
    if (!bit) continue;
    const key = bit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bits.push(bit);
    originals.push(note);
  }
  if (!bits.length) return null;
  const first = frameIntroHint(bits[0]!, sectionTitle, originals[0] ?? "");
  if (bits.length === 1) return finishSentence(first);
  const rest = bits.slice(1).map((b) => lowerFirst(b.replace(/[.]+$/, "")));
  return finishSentence(`${first.replace(/[.]+$/, "")}, while ${rest.join(", and ")}`);
}

export function parseListenModelClaim(raw: string, fallback: string | null): string | null {
  let text = (raw ?? "").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text) as { claim?: unknown; summary?: unknown; text?: unknown };
      const picked = parsed.claim ?? parsed.summary ?? parsed.text;
      if (typeof picked === "string" && picked.trim()) text = picked.trim();
    } catch {
      /* plain text is fine */
    }
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text || isClosingPhrase(text) || isNoteFragment(text) || text.length < 12) return fallback;
  if (/I'?m hearing\s*[“"']/.test(text)) return fallback;
  if (isMessyListenCopy(text) || /\b(?:maybe|hear me out|I think)\b/i.test(text)) return fallback;
  const cleaned = finishSentence(stripLeadIns(text).replace(/\s*;\s+/g, ", "));
  if (!cleaned || isMessyListenCopy(cleaned) || /\b(?:maybe|hear me out|I think)\b/i.test(cleaned)) return fallback;
  return cleaned;
}

/** First-tap recap before "Keep my angle" actually advances. */
export function keepAngleSummary(note: string, title: string): string {
  const part = (title || "this section").toLowerCase();
  const raw = (note ?? "").replace(/\s+/g, " ").trim();
  const claim = raw && !isClosingPhrase(raw) && !isNoteFragment(raw) ? raw : "";
  if (claim) {
    return `Just to confirm before we leave your ${part}: you want to keep this angle — “${claim}.” Tap below if that's right, or tell me what to change.`;
  }
  return `Just to confirm before we leave your ${part}: you want to keep the angle you already have. Tap below if that's right, or tell me what to change.`;
}

/** Official section note for recaps and pressure tests; never a confirm/closing phrase. */
export function officialListenNote(sectionIdeas: string[] | undefined, lastYou = ""): string {
  const kept = (sectionIdeas ?? []).map((n) => n.replace(/\s+/g, " ").trim()).filter((n) => n && !isClosingPhrase(n) && !isNoteFragment(n));
  if (kept.length) return kept.join(" ");
  const last = lastYou.replace(/\s+/g, " ").trim();
  if (last && !isClosingPhrase(last) && !isNoteFragment(last)) return last;
  return "";
}

const GENERIC_PRESSURE =
  /a reasonable reader could see this another way|the same evidence also supports the opposite reading|push back on (that|this) claim/i;

/**
 * One-line, one-question pressure test tied to the claim itself.
 * Never the generic "same evidence / opposite reading" line.
 */
export function specificPressureTest(claim: string): string {
  const t = (claim ?? "").replace(/\s+/g, " ").trim();
  if (/less press/i.test(t)) {
    const pressWho = /servant leaders?/i.test(t) ? "servant leaders" : "they";
    return `A reader might ask whether ${pressWho} really get less press, or whether it just feels that way. Do you have an example, like Walton, where the press credited something else?`;
  }
  if (/more (of the )?credit/i.test(t)) {
    return "A reader might ask whether they really get more of the credit, or whether it just feels that way. Do you have an example, like Walton, where the press credited something else?";
  }
  if (/costco/i.test(t)) {
    return "A reader might ask whether a Costco comparison really belongs here, or whether it just feels like a fit. What one fact about Costco would actually support your point?";
  }
  const gist = quoteOnWordBoundary(t.replace(/^your intro hints that\s+/i, ""), 80).replace(/[.]+$/, "");
  if (gist && !isClosingPhrase(gist) && !isNoteFragment(gist)) {
    return `A reader might ask whether “${gist}” really holds, or whether it just feels that way. What's one example that would show it?`;
  }
  return "A reader might ask whether this really holds, or whether it just feels that way. What's one example that would show it?";
}

/** After a confirm phrase: summarize the idea once, then the pressure-test offer. */
export function listenConfirmOffer(claim: string, _title = ""): string {
  void _title;
  const summary = (claim ?? "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  const pressure = specificPressureTest(claim);
  if (summary && !isClosingPhrase(summary) && !isNoteFragment(summary)) {
    return `${finishSentence(summary)} ${pressure}`.replace(/\s+/g, " ").trim();
  }
  return pressure;
}

/**
 * Pressure-test copy specific to the claim. A named counterpoint stays;
 * a generic "opposite reading" line is replaced with a claim-specific question.
 */
export function pressureTestLine(input: {
  claim?: string | null;
  reason?: string | null;
  counterpoint?: string | null;
}): string {
  const rawClaim = (input.claim ?? "").replace(/\s+/g, " ").trim();
  const claim = rawClaim && !isClosingPhrase(rawClaim) && !isNoteFragment(rawClaim)
    ? quoteOnWordBoundary(rawClaim, 120)
    : "";
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim();
  const counter = asCounterpoint(input.counterpoint);
  const genericCounter = !counter || isGenericPressureReason(counter);
  const genericReason = !reason || isGenericPressureReason(reason);
  if (claim && !genericCounter) {
    return `You said “${claim}.” A reasonable reader might counter that ${counter}.`;
  }
  if (claim && !genericReason && !/you said /i.test(reason)) {
    const specificReason = /[.!?]$/.test(reason) ? reason : `${reason}.`;
    return `You said “${claim}.” ${specificReason}`;
  }
  if (claim) return specificPressureTest(rawClaim);
  if (!genericReason) return /[.!?]$/.test(reason) ? reason : `${reason}.`;
  if (!genericCounter) return `A reasonable reader might counter that ${counter}.`;
  return specificPressureTest(rawClaim);
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
