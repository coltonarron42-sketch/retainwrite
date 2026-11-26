/**
 * Stage 1, short and sweet (Colton t221u, Nov 25, 2026; PC-32): after the read-back is confirmed,
 * Pau asks once whether they've already thought about what to write. An idea gets reflected back,
 * one light follow-up, an acknowledgment, and is saved for later. Nothing is forced: "no idea" is fine.
 * Where they are (has ideas / has read the material / no clue) is saved so Stage 2 meets them there.
 * // SOP: coaching only, never generate submission text
 */

export const IDEAS_CHECK_ID = "ideas_check";
export const IDEAS_FOLLOW_ID = "ideas_follow";

export const IDEAS_CHECK_ASK =
  "Have you already thought about what you want to write about? Even a rough idea counts, and if you've got nothing yet, that's totally fine.";

export type StartingKind = "has_ideas" | "read_material" | "no_clue";

export type StartingPoint = {
  kind: StartingKind;
  /** Their idea in their own words (verbatim), when they shared one. */
  ideas?: string;
  /** Their answer to the one light follow-up (verbatim). */
  followUp?: string;
  readMaterial: boolean;
  at: number;
};

const NOTHING = /^\s*(no+|nope|nah|not (?:yet|really|sure)|no idea|idk|i don'?t know|dunno|nothing( yet)?|none( yet)?|haven'?t|i have not|not at all|no clue|skip|pass|n\/a|\?+)\b[\s\S]{0,40}$/i;
/** QA 4:57 PM: "I don't have any ideas yet", "no ideas so far", "not really, nothing yet". */
const NO_IDEAS = /\b(?:i\s+(?:don'?t|do not|didn'?t|haven'?t|have not)\s+(?:have|got|thought of|come up with)\s+(?:any|an|a)?\s*(?:ideas?|clue|thoughts?|anything)|no\s+ideas?(?:\s+yet)?|not\s+(?:any|a single)\s+ideas?|nothing\s+(?:yet|so far|in mind)|haven'?t\s+(?:thought|decided)\s+(?:about\s+it|yet))\b/i;

/**
 * Shared guard (QA 4:57 PM): a yes / no / confirm phrase ("Yes, that's right", "yep", "correct",
 * "sounds good", "no") is a reply to Pau, NEVER idea content. Used wherever their words are saved.
 */
export function isConfirmOnly(text: string | null | undefined): boolean {
  const t = String(text ?? "").trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[.!?,\s]+$/g, "");
  if (!t) return true;
  const rest = t.replace(/^(?:oh\s+|um+\s+|well\s+)?(?:yes|yeah|yep|yup|ya|sure|ok(?:ay)?|right|correct|exactly|true|perfect|totally|absolutely|definitely|no|nope|nah|not really|pretty much|basically|sounds (?:right|good)|you got it|got it|that'?s (?:it|right|correct|all|everything)|that works|all good|i'?m good|good for now|for now)\b[\s,.!-]*/i, "");
  if (rest === t) return false;
  return !rest || isConfirmOnly(rest) || /^(?:that'?s (?:it|right|correct|all)|you got it|exactly|for now|thanks?|thank you)$/.test(rest);
}
const READ = /\b(i(?:'ve| have)? (?:already )?read|i did read|read (?:it|them|both|all|the (?:chapter|article|reading|book))|finished (?:it|them|the reading)|went through (?:it|the reading))\b/i;
const NOT_READ = /\b(haven'?t|have not|didn'?t|did not|not yet|never) (?:read|looked|opened)\b/i;

/** True when the answer actually carries an idea (not a "no", a shrug, or only "I read it"). */
export function hasIdea(text: string): boolean {
  const t = text.trim();
  if (!t || NOTHING.test(t) || isConfirmOnly(t)) return false;
  if (NO_IDEAS.test(t) && t.split(/\s+/).length < 14) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < 2) return false;
  // "I read it but no idea yet" is not an idea.
  if (/\b(no idea|not sure what|don'?t know what|no clue|nothing yet)\b/i.test(t) && words < 14) return false;
  return true;
}

export function classifyStartingPoint(input: { ideas?: string | null; followUp?: string | null; lostAtStart?: boolean; hasReading?: boolean; materialAnswer?: string | null }): StartingPoint {
  const ideas = isConfirmOnly(input.ideas) ? "" : (input.ideas ?? "").trim();
  const said = [ideas, input.followUp ?? "", input.materialAnswer ?? ""].join(" ");
  const readMaterial = !input.lostAtStart && READ.test(said) && !NOT_READ.test(said);
  const idea = hasIdea(ideas);
  return {
    kind: idea ? "has_ideas" : readMaterial ? "read_material" : "no_clue",
    ...(idea ? { ideas: ideas.slice(0, 2000) } : {}),
    ...(idea && input.followUp?.trim() && !isConfirmOnly(input.followUp) ? { followUp: input.followUp.trim().slice(0, 2000) } : {}),
    readMaterial,
    at: Date.now(),
  };
}

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim().replace(/[.!?\s]+$/, "");
  const w = t.split(" ");
  return w.length > n ? `${w.slice(0, n).join(" ")}…` : t;
};

/** "I think…" → "you think…" for a short reflect-back of their own words. */
function second(text: string): string {
  const map: Record<string, string> = { i: "you", "i'm": "you're", "i've": "you've", "i'd": "you'd", "i'll": "you'll", me: "you", my: "your", mine: "yours", myself: "yourself", am: "are" };
  return text.replace(/[\u2018\u2019]/g, "'").replace(/\b(i'm|i've|i'd|i'll|i|me|my|mine|myself|am)\b/gi, (w) => map[w.toLowerCase()] ?? w);
}

/** Their idea without the lead-in ("I'm thinking about…", "maybe I'd write about…"). */
export function ideaGist(text: string): string {
  return text
    .trim()
    .replace(/^(?:yes|yeah|yep|kind of|sort of|i guess|maybe|um+|so|well)[,.!\s]+/i, "")
    // QA 4:57 PM: "also she trained…" echoes as "she trained…".
    .replace(/^(?:oh,?\s+)?(?:also|and also|and|plus|oh and|too)[,\s]+/i, "")
    .replace(/^(?:i'?m|i am|i was)\s+(?:thinking|leaning|planning|hoping)\s+(?:about|of|on|towards?|to)\s+(?:writing about\s+)?/i, "")
    .replace(/^i\s+(?:want|plan|hope|think i(?:'d| would)? (?:like|want))\s+to\s+(?:write|focus|argue)\s+(?:about|on|that)?\s*/i, "")
    .replace(/^i(?:'d| would)\s+(?:write|focus|argue)\s+(?:about|on|that)?\s*/i, "");
}

/** Pau's acknowledgment after the ideas step (no question). */
export function ideasAck(point: Pick<StartingPoint, "kind">): string {
  if (point.kind === "has_ideas") return "Love it. I saved that, and we'll build on it in Stage 2.";
  if (point.kind === "read_material") return "Nice, you've done the reading, so we'll start from what stuck with you in Stage 2.";
  // QA 4:57 PM: no ideas yet gets no reflection and no praise.
  return "That's totally fine, we'll find one together in Stage 2.";
}

/** Stage 2's opening line that meets them where they are (used when there's no older Stage 1 decision). */
export function stage2StartingLine(point: StartingPoint | null | undefined): string | null {
  if (!point) return null;
  if (point.kind === "has_ideas" && point.ideas) return `In Stage 1 you said you're thinking about ${clip(second(ideaGist(point.ideas)), 25)}. We'll start there.`;
  if (point.kind === "read_material") return "You've already read the material, so we'll start from what stood out to you.";
  return "No ideas yet is a fine place to start. We'll build them up one section at a time.";
}

/* ---------------- the ideas step: keep it light (Colton t222u) ----------------
 * Acknowledge → summarize back for confirmation → note it → move on. If they want to say more:
 * listen, acknowledge, summarize, note, and keep going until they say that's it for now.
 * Never a chain of probing questions: at most ONE light clarifying question, and only when the
 * idea is unclear. Every other turn is a confirmation of their own words, not a new probe.
 */
export const MAX_IDEA_TURNS = 4;

export type IdeaTurnKind = "ask" | "clarify" | "confirm";
export type IdeaStep = { id: string; kind: IdeaTurnKind; text: string };
type Said = { questionId: string; questionText?: string; answerText: string };

export const ideaStepId = (i: number) => (i === 1 ? IDEAS_FOLLOW_ID : `${IDEAS_FOLLOW_ID}_${i}`);
export const isIdeasStepId = (id: string) => id === IDEAS_CHECK_ID || id === IDEAS_FOLLOW_ID || id.startsWith(`${IDEAS_FOLLOW_ID}_`);

/** "Yes", "that's it", "sounds right", "nope, that's all": they're done adding. */
export function isDoneSaying(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'");
  if (!t) return true;
  if (/\b(that'?s (it|all|everything)|for now|nothing (else|more)|no(pe)?,? that'?s|all good|i'?m good|good for now)\b/.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words <= 6 && /^(yes|yeah|yep|yup|ya|sure|ok(ay)?|right|correct|exactly|pretty much|basically|sounds (right|good)|you got it|perfect|no|nope|nah)\b/.test(t)) return true;
  return words < 3;
}

/** Too thin to note as-is ("leadership", "maybe sports"): one light clarifying question is OK. */
export function isUnclearIdea(text: string): boolean {
  // QA 4:57 PM: "Elon Musk, servant leadership" is terse but concrete: summarize it back, never drill.
  if (CONCRETE.test(text) || /\b[A-Z][a-z'’-]+\s+[A-Z][a-z'’-]{2,}\b/.test(text)) return false;
  const words = ideaGist(text).split(/\s+/).filter(Boolean).length;
  return words < 5 || /\b(something (about|like|with)|kind of|sort of|not sure (how|exactly))\b/i.test(text) && words < 12;
}

const CONCRETE = /\b(servant|transformational|situational|transactional|democratic|autocratic|authentic|charismatic|laissez-faire|participative|adaptive|visionary|coaching)\b/i;

export function ideasClarify(ideas: string): string {
  return `Just so I note it right: when you say "${clip(ideaGist(ideas), 12)}", what's the part you'd want to write about? One line is plenty.`;
}

export function ideasConfirm(text: string, first: boolean): string {
  const gist = clip(second(ideaGist(text)), 28);
  return first
    ? `Ooh, I like that. So you're thinking: ${gist}. Did I get that right?`
    : `Got it, I noted that too: ${gist}. Is that it for now, or is there more you want to add?`;
}

/**
 * The ideas steps for this paper so far, rebuilt from their answers (a question already asked
 * keeps its exact wording). Ends when they have no idea, say they're done, or after MAX_IDEA_TURNS.
 */
export function ideasPlan(answers: Said[]): IdeaStep[] {
  const latest = (id: string) => [...answers].reverse().find((a) => a.questionId === id);
  const answer = (id: string) => latest(id)?.answerText.trim() ?? null;
  const asked = (id: string, fallback: string) => latest(id)?.questionText?.trim() || fallback;
  const steps: IdeaStep[] = [{ id: IDEAS_CHECK_ID, kind: "ask", text: asked(IDEAS_CHECK_ID, IDEAS_CHECK_ASK) }];
  const first = answer(IDEAS_CHECK_ID);
  if (!first || !hasIdea(first)) return steps;
  let prev: IdeaTurnKind = "ask";
  let toConfirm = first;
  let clarified = false;
  for (let i = 1; i <= MAX_IDEA_TURNS; i++) {
    const id = ideaStepId(i);
    const kind: IdeaTurnKind = !clarified && prev === "ask" && isUnclearIdea(first) ? "clarify" : "confirm";
    const text = asked(id, kind === "clarify" ? ideasClarify(first) : ideasConfirm(toConfirm, !steps.some((s) => s.kind === "confirm")));
    steps.push({ id, kind, text });
    const said = answer(id);
    if (said === null) break;
    if (kind === "clarify") {
      clarified = true;
      toConfirm = isDoneSaying(said) || isConfirmOnly(said) ? first : `${ideaGist(first)}: ${said}`;
    } else {
      if (isDoneSaying(said) || isConfirmOnly(said)) break;
      toConfirm = said;
    }
    prev = kind;
  }
  return steps;
}

/** Everything they said about their idea, in order (their words), for the saved starting point. */
export function ideasSaid(answers: Said[]): { ideas: string | null; followUp: string | null } {
  const latest = (id: string) => [...answers].reverse().find((a) => a.questionId === id)?.answerText.trim() || null;
  const first = latest(IDEAS_CHECK_ID);
  const more: string[] = [];
  for (let i = 1; i <= MAX_IDEA_TURNS; i++) {
    const t = latest(ideaStepId(i));
    if (t && !isDoneSaying(t) && !isConfirmOnly(t)) more.push(t);
  }
  return { ideas: first, followUp: more.length ? more.join(" ") : null };
}
