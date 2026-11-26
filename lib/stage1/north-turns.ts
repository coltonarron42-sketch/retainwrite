import { checklistLabel } from "@/lib/stage1/reading-label";
import { affirmsStyle, rejectsStyle } from "@/lib/stage1/style-negation";
import { singleNamedLeader } from "@/lib/stage1/single-name";
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

/**
 * QA 1:11 AM #4: a non-answer ("first quick message", "test", "hi", "asdf") is never saved as
 * their answer or reason; Pau re-asks gently instead.
 */
const FILLER =
  /^(?:(?:just\s+)?(?:a\s+)?(?:(?:first|quick|test|random|short|little)\s+)+(?:message|msg|reply|note|post|one|try)|(?:just\s+)?(?:a\s+)?test(?:ing)?(?:\s+(?:test(?:ing)?|message|1|123|one two))*|hi+|hey+|hello+|yo|sup|hiya|howdy|asdf\w*|qwer\w*|jkl\w*|blah(?:\s+blah)*|lol+|lmao|idc|nothing|n\/a|na|none|whatever|something|stuff|\.+|\?+|[^a-z0-9]+|(?:just\s+)?(?:typing|checking)(?:\s+(?:something|this|in|it out))?)[.!?\s]*$/i;
export function isFillerSaying(text: string): boolean {
  const raw = norm(text);
  if (!raw) return false;
  const t = raw.replace(/[.!?,\s]+$/, "");
  if (!t) return true;
  if (AMBIG.test(t) || YES.test(t) || NO.test(t)) return false;
  if (FILLER.test(t) || /^(?:([a-z])\1{2,}|[a-z]{1,2})$/i.test(t) || EMPTY_REASON.test(t)) return true;
  // QA 11:08: "second quick message" (any run of filler phrases and nothing else) is filler too.
  let rest = t;
  for (let i = 0; i < 6 && FILLER_LEAD.test(rest); i++) rest = rest.replace(FILLER_LEAD, "").trim();
  return rest !== t && !rest;
}
/** QA 11:08: a reason with nothing in it ("because it's good") is a non-answer, never part of the take. */
const EMPTY_REASON = /^(?:(?:because|cuz|cause|bc)\s+)?(?:it'?s|its|it is|that'?s|thats)\s+(?:good|better|nice|cool|fine|great|right|ok(?:ay)?|the best)$/i;
const EMPTY_REASON_LEAD = /^(?:because|cuz|bc)\s+(?:it'?s|its|it is)\s+(?:good|better|nice|cool|fine|great)[.!?,;:\s-]+(?=[A-Z])/;

const FILLER_LEAD = /^(?:(?:just\s+)?(?:a\s+|another\s+)?(?:(?:first|second|third|fourth|another|quick|test|random|short|little)\s+)+(?:message|msg|reply|note|post|one|try)|test(?:ing)?(?:\s+(?:test(?:ing)?|1|123))*)\b[.!?,;:\s-]*/i;
/**
 * QA 3:26 AM #4: filler never becomes part of a stored answer. Drops filler lines and a
 * leading run of filler phrases ("first quick message second quick message When Walmart…").
 */
export function withoutFiller(text: string): string {
  const lines = String(text ?? "")
    .split(/\n+/)
    .map((line) => {
      let t = line.trim();
      for (let i = 0; i < 6 && (FILLER_LEAD.test(t) || EMPTY_REASON_LEAD.test(t)); i++) t = t.replace(FILLER_LEAD, "").trim().replace(EMPTY_REASON_LEAD, "").trim();
      return t;
    })
    .filter((line) => line && !isFillerSaying(line));
  return lines.join("\n").trim();
}

/**
 * QA 2:12 PM #1: messages sent back to back are one turn. The real answer is what Pau answers;
 * a trailing (or leading) filler ("ok", "hmm") never turns it into a non-answer.
 */
const HUM = /^(?:h+m+|u+h+|u+m+|e+r+m*|mm+|wait|hold on|one sec(?:ond)?|sec|brb)[.!?,\s]*$/i;
const SIGN_OFF = /^(?:ok(?:ay)?|k+|kk|alright|all right|cool|got it|that'?s it|done)[.!\s]*$/i;
/** QA round 6: a message that is only filler or a sign-off ("ok", "hmm", "one sec"): nothing to answer on its own. */
export function isFillerOnly(text: string): boolean {
  const parts = String(text ?? "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => withoutFiller(p) === "" || HUM.test(p) || SIGN_OFF.test(p));
}

export function keepSubstance(parts: string[]): string {
  const all = parts.map((p) => p.trim()).filter(Boolean);
  const real = all.filter((p) => withoutFiller(p) !== "" && !HUM.test(p));
  // A bare "ok" after the answer is a sign-off, not a reply to the offer (a leading "ok" may be one, so it stays).
  while (real.length > 1 && SIGN_OFF.test(real[real.length - 1]!)) real.pop();
  return (real.length ? real : all).join("\n");
}

/** The gentle re-ask after a non-answer: one short line, then the same question (QA 1:11 AM #4). */
export function fillerNudge(qid: string): string {
  switch (qid) {
    case "material_check":
      return "No worries, take your time. In a sentence, where are you with it so far?";
    case "decision_pick":
      return "All good. When you're ready, which one would you pick, and why?";
    case "decision_why":
      return "No rush. What's your main reason for that pick, even one rough sentence?";
    case "leader_pick":
      return "Take your time. Which leader do you want to use as your example?";
    case "stance_early":
      return "No rush, that one doesn't count as your take. What do you think the answer is, and why? Rough is fine.";
    case "own_story":
      return "All good, that one doesn't count yet. What angle would you take, in your own words?";
    default:
      return "No rush. When you're ready, answer in a sentence or two, even roughly.";
  }
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
/** What each style sounds like in a student's own words (only their words count, never the sheet). */
const STYLE_CUES: Record<string, RegExp> = {
  servant: /\b(?:servant|serv(?:e|ed|es|ing)|people first|put (?:people|the team|others|us|everyone) first|cared|car(?:e|es|ing) about|listen(?:ed|s|ing)?|help(?:ed|s|ing)? (?:people|others|everyone|us)|looked out for)\b/i,
  transformational: /\b(?:transformational|vision|inspir\w*|big picture|motivat\w*|believe in|bought in|bigger goal)\b/i,
  situational: /\b(?:situational|adapt\w*|adjust\w*|depend(?:s|ed|ing)? on|each person|flex\w*|fit(?:s|ted)? the (?:moment|situation|person))\b/i,
  behavioral: /\b(?:behavioral|task|tasks|getting (?:the )?(?:work|job) done|deadlines|organized|relationships?)\b/i,
  democratic: /\b(?:democratic|vot\w*|everyone (?:had|has|gets) a say|asked (?:us|everyone)|team decid\w*)\b/i,
  transactional: /\b(?:transactional|rewards?|bonus\w*|consequences|incentives?)\b/i,
  authentic: /\b(?:authentic|honest|real values|genuine)\b/i,
};
const listOr = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
const cueKey = (label: string) => label.toLowerCase().match(/[a-z]+/)?.[0] ?? "";

/**
 * QA ethos should-fix (after #77): the two offered in a narrowed turn, and why those two, grounded in
 * what the student actually said ("you said “he listened to everyone”"). Nothing said that points
 * anywhere: the first two, and the rest is still on the table (never an invented reason).
 */
export function groundedTwo(opts: DecisionOption[], said: string): { two: DecisionOption[]; quote: string | null; rest: DecisionOption[] } {
  const words = String(said ?? "");
  const hits: { o: DecisionOption; at: number; phrase: string }[] = [];
  for (const o of opts) {
    const re = STYLE_CUES[cueKey(o.label)];
    if (!re) continue;
    const m = re.exec(words);
    if (m && !rejectsStyle(words, m[0])) hits.push({ o, at: m.index, phrase: m[0] });
  }
  hits.sort((a, b) => a.at - b.at);
  const picked = hits.slice(0, 2).map((h) => h.o);
  for (const o of opts) if (picked.length < 2 && !picked.includes(o)) picked.push(o);
  const quote = hits.length ? (() => {
    const h = hits[0]!;
    // Their phrase in their own words: the clause it sits in (never across a line or sentence), filler
    // in front dropped ("hmm", "I guess", "maybe"), at most ~10 whole words around the cue.
    const clauseStart = Math.max(...["\n", ".", "!", "?", ";", ","].map((c) => words.lastIndexOf(c, h.at - 1))) + 1;
    const ends = ["\n", ".", "!", "?", ";", ","].map((c) => words.indexOf(c, h.at + h.phrase.length)).filter((i) => i >= 0);
    const clause = words.slice(clauseStart, ends.length ? Math.min(...ends) : words.length);
    const at = h.at - clauseStart;
    const before = clause.slice(0, at).trim().split(/\s+/).filter(Boolean);
    const after = clause.slice(at + h.phrase.length).trim().split(/\s+/).filter(Boolean);
    const FILLER = /^(?:hmm+|um+|uh+|idk|i|guess|think|maybe|like|so|well|okay|ok|not|sure|just)$/i;
    let b = before.slice(-5);
    while (b.length && FILLER.test(b[0]!.replace(/[^a-z]/gi, ""))) b = b.slice(1);
    return [...b, h.phrase, ...after.slice(0, 4)].join(" ").replace(/\s+/g, " ").replace(/^[\s,.;:!?]+|[\s,.;:!?]+$/g, "").trim();
  })() : null;
  return { two: picked.slice(0, 2), quote, rest: opts.filter((o) => !picked.slice(0, 2).includes(o)) };
}

/**
 * QA (5:06 PM): every style definition has one shape, "a leader who…" / "a leader [verb]ing…".
 * Used when an option's own line (e.g. a model-written "why") isn't in that shape.
 */
const STYLE_DEFS: Record<string, string> = {
  servant: "a leader who puts the team's needs first so people come through the change together",
  transformational: "a leader selling a shared vision so people want the change",
  situational: "a leader shifting style to fit how ready the team is",
  behavioral: "a leader balancing getting the work done with caring for the people",
  democratic: "a leader who brings the team into the big decisions",
  transactional: "a leader trading clear rewards for results",
  authentic: "a leader who leads from their own values, openly",
};
const leaderShaped = (w: string) => /^a leader (?:who\b|\w+ing\b)/i.test(w);

/** "lets you show a leader selling a shared vision…" → "a leader selling a shared vision…" (a plain picture of the style). */
export const asLeader = (why: string, label = "") => {
  const w0 = plain(why).replace(/^lets you (?:show|argue that|argue|weigh|focus on)\s+/i, "");
  const w = /^(?:a |an |the )?leader\b/i.test(w0) ? w0.replace(/^(?:a |an |the )/i, "a ") : w0;
  if (leaderShaped(w)) return w;
  // Not a leadership style (e.g. "Primacy effect"): keep its own line whole, never a half-stripped one.
  return STYLE_DEFS[cueKey(label)] ?? plain(why);
};
/** One definition line, the same in every turn: "• Servant: a leader who puts…". */
const defLine = (o: DecisionOption) => `• ${o.label}: ${o.why ? asLeader(o.why, o.label) : STYLE_DEFS[cueKey(o.label)] ?? "a real, well-known choice"}.`;

/**
 * QA (after #80): the assignment's own focus, as a clause Pau can lean the narrow-to-two on
 * ("…most effective for leading a team through change, using…" → "leading a team through change").
 * Only what the parsed prompt literally says; null when there's no clear focus phrase (never invented).
 */
export function assignmentFocus(prompt: string | null | undefined): string | null {
  const t = String(prompt ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const m = /\b(?:for|in|when|while|at)\s+((?:[a-z]+ing)\b[^,.;:?!()]{6,70}?)(?=\s*(?:[,.;:?!()]|$|\s+(?:using|with|citing|based on|drawing on|and use|in (?:an? )?(?:\d|essay|paper)|in apa)\b))/i.exec(t);
  if (!m) return null;
  const f = m[1]!.trim().replace(/\s+/g, " ");
  const words = f.split(" ");
  if (words.length < 2 || words.length > 10) return null;
  // A gerund that's really a requirement, not the paper's focus ("for using APA", "in writing 1,200 words").
  if (/^(?:using|writing|citing|including|following|making|getting)\b/i.test(f) || /\b(?:apa|mla|words?|pages?|sources?|citations?)\b/i.test(f)) return null;
  return f.charAt(0).toLowerCase() + f.slice(1);
}

const FOCUS_STOP = /^(?:a|an|the|of|to|in|on|for|with|and|or|through|into|during|their|your|its|his|her|our|leading|leader|leaders|leadership|style|styles|one|real)$/i;
const focusWords = (focus: string) => [...new Set(focus.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 2 && !FOCUS_STOP.test(w)))];
const stem = (w: string) => w.replace(/'s$/, "").replace(/(?:ing|es|s)$/, "");

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
  /** QA ethos (after #77): everything the student has said so far, so the two offered are grounded in it. */
  said?: string;
  /** QA (after #80): the parsed assignment prompt/topic, for a real reason behind the two offered. */
  focus?: string | null;
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
  // QA 11:08: one ask per turn (the catch-up stays a button, not a second question).
  const ask = `Want to start with ${rec.label}? Say yes or no, and a few words on why.`;
  const ppl = (input.people ?? []).filter((p) => p.label !== rec.label).slice(0, 3);
  const exLine = input.kind !== "leader" && ppl.length
    ? `Leaders people often write about here: ${ppl.map((p) => `${p.label}${p.why ? ` (${plain(input.unread ? scrubUnreadRefs(p.why) : p.why)})` : ""}`).join("; ")}.`
    : null;
  // QA 11:08: short: the options and one ask. Example leaders only when they're confused and
  // being taught (Colton 12:08), never on a plain "make this easier".
  // QA round 5 minor: a second "make it easier" in a row is short (no second copy of the same list).
  // QA round 6 minor: after the short version, change approach instead of asking the same thing again.
  // QA ethos should-fix (after #74): Pau never picks FOR them ("nothing advances without the
  // student's input"). Round 4 narrows to two, one plain line each, and asks for a gut pick, with
  // the reading one tap away; round 5 is a different way in (someone they've seen lead); after
  // that, the two again in other words. No "ok" takes a pick here: they name one.
  const other = opts.find((o) => o.label !== rec.label) ?? null;
  const grounded0 = input.kind === "leader" ? null : groundedTwo(opts, input.said ?? "");
  // QA (after #80): nothing in their words points anywhere: lean on the assignment's own focus.
  // The two are the ones whose definitions speak to that focus, only when that clearly sets them
  // apart from the rest; otherwise the list order stays and the line names the focus neutrally.
  const focus = grounded0 && !grounded0.quote && opts.length > 2 ? assignmentFocus(input.focus) : null;
  const fw = focus ? focusWords(focus).map(stem) : [];
  const score = (o: DecisionOption) => {
    const d = asLeader(o.why ?? "", o.label).toLowerCase().split(/[^a-z']+/).map(stem);
    return fw.filter((w) => d.includes(w)).length;
  };
  const ranked = focus ? opts.map((o, i) => ({ o, i, s: score(o) })).sort((a, b) => b.s - a.s || a.i - b.i) : [];
  const sharper = ranked.length > 2 && ranked[1]!.s > 0 && ranked[1]!.s > ranked[2]!.s;
  const grounded = grounded0 && sharper
    ? { ...grounded0, two: ranked.slice(0, 2).sort((a, b) => a.i - b.i).map((r) => r.o), rest: ranked.slice(2).sort((a, b) => a.i - b.i).map((r) => r.o) }
    : grounded0;
  const two = grounded ? grounded.two : other ? [rec, other] : [rec];
  // QA (5:06 PM): the two read as plain definitions ("• Transformational: a leader selling…"), never "lets you show…".
  const line2 = (o: DecisionOption) => (input.kind === "leader" ? `• ${o.label}: ${o.why ? plain(o.why) : "a real, well-known choice"}.` : defLine(o));
  // The reading button sits under the style question (the reading-help row); a leader pick has none.
  const readFirst = input.kind === "leader" ? "" : " Or if you'd rather look at the reading first, tap “Catch me up on the reading first”.";
  const names = two.map((o) => o.label).join(" or ");
  // QA ethos (after #77): why these two, from their own words; otherwise the rest stays on the table (chips match the two).
  const restLine = grounded?.rest.length
    ? `${grounded.rest.map((o) => o.label).join(" and ")} ${grounded.rest.length > 1 ? "are" : "is"} still on the table if neither fits.`
    : "";
  const why2 = grounded?.quote
    ? `You said “${grounded.quote}”, so these two are the closest fit.`
    : focus && sharper
      ? `Since your prompt is about ${focus}, these two speak to that most directly; ${restLine}`
      : focus
        ? `Your prompt is about ${focus}, and either of these is a real way to argue it; ${restLine}`
        : grounded?.rest.length
          ? `These two are a good place to start; ${restLine}`
          : null;
  const narrow = [`Let's narrow it to two.${why2 ? ` ${why2}` : ""}`, ...two.map(line2), `Which one feels closer, just going with your gut: ${names}?${readFirst}`];
  const narrow2 = [`No wrong answer here. Down to two.${why2 ? ` ${why2}` : ""}`, ...two.map(line2), `Gut call: ${names}?${readFirst}`];
  const otherWay = [`Let's come at it from a different side. Forget the labels for a second: think of someone who led a team you were on, at work, in sports, anywhere. What's one thing they did?`];
  // QA ethos (after #77): style turns 2 and 3 are neutral: plain definitions and one open question,
  // never a recommendation or a lean toward one style. The gut pick between two waits for turn 4.
  if (input.kind !== "leader" && step <= 1) {
    const defs = opts.map(defLine);
    const head = input.confused
      ? `That's okay, that's why you're here! ${concept ? `${concept} ` : ""}Here's the short version of each:`
      : step === 0
        ? `No problem. Here's the short version of each:`
        : `Another way in:`;
    const q1 = `Which one sounds most like a leader you know?`;
    // Example leaders only while teaching a confused student (Colton 12:08); never a style lean.
    let paras = [head, ...defs, ...(exLine && input.confused && step === 0 ? [exLine] : []), q1];
    // Turn 3: the list was just given (QA round 5: never a second copy), so one short, open question.
    if (step === 1 && !input.confused) paras = [`Another way in, no wrong answer: which of these sounds closest to how you'd want to be led yourself: ${listOr(opts.map((o) => o.label))}?`];
    if (paras.join("\n") === input.last) paras = [`Okay, a different angle.`, ...defs, `Which one sounds most like someone you've seen lead?`];
    return { paras, recommend: null, offerCatchUp };
  }
  if (step >= 1 && (!input.confused || input.kind !== "leader")) {
    const short = [`No rush. Simplest way in: start with ${rec.label}${rec.why ? `, since it ${plain(rec.why).replace(/^lets you\s+/i, "lets you ")}` : ""}.`, ask];
    const pick = step === 1 ? short : step === 2 ? narrow : step === 3 ? otherWay : narrow2;
    const paras = pick.join("\n") === input.last ? (pick === narrow ? narrow2 : narrow) : pick;
    const narrowed = paras === narrow || paras === narrow2;
    // Narrowed: nothing is recommended (no yes/ok takes a pick), and the reading is offered.
    return { paras, recommend: narrowed || paras === otherWay ? null : rec, offerCatchUp: narrowed && input.kind !== "leader" ? true : offerCatchUp };
  }
  let paras = [intro, ...lines, ...(exLine && step <= 1 && input.confused ? [exLine] : []), `${recLine} ${ask}`];
  if (paras.join("\n") === input.last) paras = [`Okay, a different angle.`, ...lines, `${recLine} ${ask}`];
  return { paras, recommend: rec, offerCatchUp };
}

/** The two labels of a narrowed turn ("Let's narrow it to two." / "No wrong answer here. Down to two:"), in order; [] otherwise. */
export function narrowedTwo(last: string | null | undefined): string[] {
  const t = String(last ?? "");
  if (!/^(?:Let's narrow it to two\.|No wrong answer here\. Down to two[.:])/.test(t)) return [];
  return [...t.matchAll(/^• ([^:\n]+):/gm)].map((m) => m[1]!.trim()).slice(0, 2);
}

/** Their gut pick after a narrowed turn: one of the two named (or "the first/second one"), else null. Never a guess. */
export function gutPickOf(text: string, two: string[]): string | null {
  const named = two.filter((l) => new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  if (named.length === 1) return named[0]!;
  if (named.length > 1) return null;
  if (/\b(?:not|neither|none|no idea|not sure|don'?t know)\b/i.test(text)) return null;
  if (/^\s*(?:the\s+)?(?:first|1st)(?:\s+one)?\b/i.test(text)) return two[0] ?? null;
  if (/^\s*(?:the\s+)?(?:second|2nd|other|last)(?:\s+one)?\b/i.test(text)) return two[1] ?? null;
  return null;
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
  return singleNamedLeader(text);
}

const IDEA_CUE =
  /\b(?:i want|i'?d like|i think|i'?m thinking|i was thinking|my idea|i plan|i'?m planning|i'?m going|i have (?:an idea|a few ideas|some ideas)|i'?d (?:use|argue|pick|go with|write)|i'?ll (?:use|argue|write)|i (?:could|would) (?:use|argue|write)|argue|my example|using)\b/i;
const GATE_STYLE = /^(servant|transformational|situational|authentic|democratic|transactional|charismatic|autocratic|adaptive|participative|visionary|coaching|behavioral|laissez-faire|affiliative|pacesetting)$/i;
/**
 * QA prod smoke (5d7aca1): every style they chose, from everything they said about their pick, in
 * order ("servant and transformational"), never only the first. A style they argue against
 * ("not transformational", "rather than servant") isn't one they chose.
 */
export function chosenStyles(texts: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    const text = String(t ?? "");
    if (!text.trim()) continue;
    for (const x of stylesIn(text)) {
      if (!GATE_STYLE.test(x) || out.includes(x)) continue;
      out.push(x);
    }
  }
  return out;
}

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
  // QA 11:08 (Walton): a style named on its own ("I'd pick Servant because…") counts too.
  for (const m of text.matchAll(KNOWN_STYLE)) {
    const x = m[1]!.toLowerCase();
    if (!out.includes(x)) out.push(x);
  }
  // QA prod smoke (64a5b2bd): "Servant, not transformational" is one style; a style only set aside never counts.
  return out.filter((x) => affirmsStyle(text, x));
}
const KNOWN_STYLE = /\b(transformational|transactional|servant|situational|democratic|autocratic|authoritarian|authentic|charismatic|laissez-faire|participative|adaptive|visionary|affiliative|pacesetting)\b(?!\s+(?:leadership|styles?)\b)/gi;

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
    // QA 3:06 minor: quote the key picks (leader and styles), not the whole sentence.
    `Locked in, in your words: “${(lockedPicks(stance, leader, styles) ?? stance).replace(/[“”"]/g, "'")}”. We can expand on it later.`,
  ];
  const lines = requirementLines(stance, { leader, styles, mustInclude: ctx.mustInclude ?? [], needsPerson: ctx.needsPerson });
  if (lines.length) paras.push("Here's the assignment's checklist, so you can see what's covered and what's next:", ...lines);
  return paras;
}

/** Their key picks in their own wording: the leader and the styles ("Sam Walton, servant and transformational leadership"). */
export function lockedPicks(stance: string, leader: string | null, styles: string[]): string | null {
  if (!leader && !styles.length) return null;
  const who = leader;
  const how = styles.length ? `${listJoin(styles)} leadership` : null;
  return [who, how].filter(Boolean).join(", ");
}

/** "I read it", "I've already read both": an explicit statement that they read it (never a mention of the author). */
export function saidReadIt(text: string): boolean {
  const t = String(text ?? "").toLowerCase();
  if (!/\b(?:i(?:'ve| have)?\s+(?:already\s+|actually\s+|just\s+)?read|i did read|i(?:'ve| have)? (?:gone|went) through|i finished (?:it|them|the|reading)|already read)\b/.test(t)) return false;
  return !/\b(?:haven'?t|have not|didn'?t|did not|not yet|never)\s+(?:\w+\s+){0,2}read\b/.test(t);
}

/** The assignment's requirements as checklist lines: ✓ covered by what they said, ○ still to do. */
export function requirementLines(
  stance: string,
  ctx: { leader: string | null; styles: string[]; mustInclude: string[]; needsPerson?: boolean },
): string[] {
  const lines: string[] = [];
  if (ctx.needsPerson || ctx.leader) lines.push(ctx.leader ? `✓ A real leader as your example: ${ctx.leader}.` : "○ A real leader as your example.");
  if (ctx.styles.length) lines.push(`✓ Your style${ctx.styles.length > 1 ? "s" : ""}: ${listJoin(ctx.styles)}.`);
  if (!ctx.leader && !ctx.styles.length && /\b(argue|think|believe|my (side|position|point))\b/i.test(stance)) lines.push("✓ Your position, in your words.");
  lines.push("○ Your case for why it answers the assignment's question. That's next.");
  const said = stance.toLowerCase();
  // QA 1:16 (PSY): a personal moment they already gave counts ("my finals week last spring").
  const personal = /\b(my|I)\b/.test(stance) && /\b(when|last|week|year|time|once|summer|spring|fall|winter)\b/i.test(stance);
  for (const raw of ctx.mustInclude.slice(0, 5)) {
    // QA prod smoke (after #83, f8df7ccc): every reading label is pinned here, the one place checklist
    // lines are built, whatever the caller passed ("Northouse, Leadership: Theory and Practice (Chapter 4)").
    const item = checklistLabel(raw, "").replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, "");
    if (!item || /\b(real leader|one leader|leader as|example)\b/i.test(item) && (ctx.needsPerson || ctx.leader)) continue;
    const marks = (item.match(/\b[A-Z][a-z]{3,}\b/g) ?? []).filter((w) => !/^(Chapter|Theory|Practice|Leadership|What|Makes|Leader|Article|Format)$/.test(w));
    const covered = marks.some((w) => said.includes(w.toLowerCase()));
    const format = /\b(words?|APA|MLA|Chicago|format|pages?|double|font|due)\b/i.test(item);
    if (/\b(own life|personal|your life|your experience|from your)\b/i.test(item) && personal) {
      lines.push(`✓ ${item}: you've got one.`);
      continue;
    }
    // QA full prod walk (8979326a): "Goleman's empathy stuff" is a mention, not "I read it". ✓ only when they said they read it.
    if (covered && !format && !saidReadIt(stance)) {
      lines.push(`○ ${item}. You brought it up; I'll help you use it.`);
      continue;
    }
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

/**
 * Colton 1:54 R1: a lost student is OFFERED a short plain summary ("Want me to summarize the
 * main leadership styles?"), then it's straight on to choosing a direction. No lecture.
 */
export function lostOffer(ask: string | null | undefined): string {
  const t = (ask ?? "").replace(/\s+/g, " ");
  const m = t.match(/\bwhich ([a-z]+(?: [a-z]+)?) (?:is|are|works?|would)\b/i);
  const what = m ? `the main ${m[1]!.toLowerCase().replace(/y$/, "ie").replace(/(?<!s)$/, "s")}` : "the key ideas you need for this paper";
  return `That's okay, that's why you're here! Want me to summarize ${what} in plain words? It's short, and then we'll go straight to picking your direction.`;
}


/* ------------------- QA round 5 (2): "I don't really know any leaders" ------------------- */

/** They don't know any leaders to use (not a style question at all). */
export function isNoLeaderSaying(text: string): boolean {
  return /\b(?:(?:don'?t|do not|dont) (?:really |actually )?know (?:any|many|of any|a lot of)(?: \w+)? leaders?|(?:can'?t|cannot) think of (?:a|any)(?: \w+)? leaders?|no idea (?:who|which leader)|(?:don'?t|do not) have (?:a|any) leaders? in mind|not sure (?:who|which leader) to (?:use|pick))\b/i.test(text);
}

/** Reassure, offer example leaders, and ask about someone from their own life. One ask, never the style again. */
export function noLeaderReply(people: DecisionOption[] = []): string[] {
  const ex = people.slice(0, 3).map((p) => `${p.label}${p.why ? ` (${plain(p.why)})` : ""}`);
  return [
    "That's completely fine. Most people don't have a famous leader in mind, and you don't need one.",
    ...(ex.length ? [`If you'd like a well-known example, people often write about ${ex.join("; ")}.`] : []),
    "You can also use someone from your own life. Who's a boss, coach or teacher you've had that people liked working for?",
  ];
}
