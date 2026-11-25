/**
 * Stage 1 on Grok Voice (Colton t159u, Nov 23): what the app shows right now,
 * as data for Pau on the call, and how spoken words join the answer box.
 * The student's spoken words are their verbatim transcript; nothing the model
 * says is ever written into an answer (the voice sample stays theirs).
 */
import { rulesStanceIntent } from "@/lib/stages/stance-intent";

/**
 * `text` describes the screen for Pau (data); `spoken` is the on-screen prompt exactly as the
 * student sees it, which the call says word for word (QA round 2, PC-29: never a paraphrase,
 * never her own question). Empty when the screen has nothing to say aloud.
 */
export type Stage1VoiceScreen = {
  key: string;
  text: string;
  choices: string[];
  spoken: string;
  /** PC-29d: the prompt without the app's note (the nudge), so a nudge alone can be said. */
  base: string;
  /** The app's note shown with the prompt (a nudge or an error), "" when none. */
  note: string;
};

/** The read-back's on-screen line: the card is the confirmation, so only its closing ask is said (QA SHOULD 3). */
export function readBackSpoken(paras: string[], turns: number): string {
  const all = paras.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!all.length) return "";
  if (turns <= 1) return all.at(-1)!;
  const joined = all.join(" ");
  return joined.length <= 400 ? joined : all.at(-1)!;
}

export function stage1VoiceScreen(s: {
  screen: string;
  qIndex: number;
  question: string | null;
  lastPau: string[];
  turns: number;
  angles: string[];
  editing: boolean;
  error: string | null;
  greeting: string;
  /** The on-screen question alone (no teaching instructions). */
  ask?: string | null;
  /** Speakable teaching text that rides before the question (key points, an honest missing-reading ask). */
  teach?: string;
}): Stage1VoiceScreen {
  const v = stage1VoiceScreenText(s);
  const spoken = stage1Spoken(s);
  const note = s.error?.replace(/\s+/g, " ").trim() ?? "";
  return { ...v, spoken, base: note ? stage1Spoken({ ...s, error: null }) : spoken, note: spoken ? note : "" };
}

function stage1Spoken(s: Parameters<typeof stage1VoiceScreen>[0]): string {
  const err = s.error ? `${s.error.trim()} ` : "";
  const join = (...xs: (string | null | undefined)[]) => xs.map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  switch (s.screen) {
    case "upload":
      return join(err, s.greeting);
    case "card":
      return join(err, readBackSpoken(s.lastPau, s.turns));
    case "coaching": {
      const q = s.ask ?? s.question ?? "";
      if (!q) return "";
      return join(err, s.teach, s.editing ? "Sure, change anything and send it again." : s.qIndex < 0 ? "Last one before the stance interview." : "", q);
    }
    case "story":
      return join(err, "Here are a few directions your paper could take, built from what you told me. Tap one, or write your own angle below.");
    case "gate":
      return join("That's everything for Stage 1. Ready for the stance interview?", err);
    default:
      return "";
  }
}

function stage1VoiceScreenText(s: Parameters<typeof stage1VoiceScreen>[0]): Omit<Stage1VoiceScreen, "spoken" | "base" | "note"> {
  const note = s.error ? ` (App note shown to the student: ${s.error})` : "";
  switch (s.screen) {
    case "upload":
      return { key: "upload", text: `${s.greeting}${note}`, choices: [] };
    case "parsing":
      return { key: "parsing", text: "The app is reading their assignment now.", choices: [] };
    case "card":
      return { key: `card:${s.turns}:${s.editing ? "edit" : ""}`, text: `Read-back of the assignment (app text): ${s.lastPau.join(" ").slice(0, 650)}${note}`, choices: [] };
    case "followup":
      return { key: "followup", text: `The app asks a follow-up about the assignment.${note}`, choices: [] };
    case "ai_policy":
      return { key: "ai_policy", text: "The app shows a note about the class's AI policy; the student taps to acknowledge it.", choices: [] };
    case "coaching":
      return { key: `q:${s.qIndex}:${s.editing ? "edit" : ""}`, text: `${s.qIndex < 0 ? "Last one before the stance interview (their early take, a few sentences). " : ""}Question on screen: ${s.question ?? ""}${note}`, choices: [] };
    case "story":
      return { key: "story", text: `Story angle: tap one of these, or describe their own angle.${note}`, choices: s.angles.slice(0, 4) };
    case "gate":
      return { key: "gate", text: `That's everything for Stage 1. Ready for the stance interview? (A clear yes starts it, or they tap Start stance interview.)${note}`, choices: ["Start stance interview"] };
    default:
      return { key: s.screen, text: note, choices: [] };
  }
}

/** Spoken words join what's already in the box, word for word. */
export function appendSpoken(prev: string, spoken: string): string {
  const t = spoken.replace(/\s+/g, " ").trim();
  if (!t) return prev;
  const p = prev.replace(/\s+$/, "");
  return p ? `${p} ${t}` : t;
}

/** "Okay, that's it" / "next" said to move on: not part of the answer. */
const CONTROL = /^(?:(?:ok(?:ay)?|yes|yeah|yep|sure|alright|so|um|uh)[,.!\s]*)*(?:that'?s (?:it|all|my answer)|i'?m (?:done|finished)|(?:go |move )?(?:on|next)(?: one| question)?|submit(?: it| that)?|save (?:it|that)|done)?[.!\s]*$/i;
export function isControlPhrase(spoken: string): boolean {
  const t = spoken.replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= 40 && CONTROL.test(t);
}

/** Requests and jailbreaks said TO Pau ("write it for me", "ignore your rules"): never part of an answer. */
const TO_COACH =
  /\b(ignore (your|the|all|any|previous) (rules|instructions)|pretend (you'?re|you are|to be)|you are now|act as|jailbreak|no limits|developer mode|(write|do|make|finish|give me) (it|this|that|my|the|an?)\b[^.?!]{0,40}\bfor me|write (my|the|an?) (whole |entire |full )?(answer|take|essay|paper|intro|introduction|paragraph|story|angle)|write (my|the|an?|this) (whole |entire |full )?(outline|thesis|section|conclusion|body)|(?:^|(?<=[.!?,]\s*)|(?<=\b(?:can|could|would|will) you (?:please )?)|(?<=\bplease ))(?:just |please )?(write|give|make) me (a|an|one|some|the)\b[^.?!]{0,30}\b(line|lines|sentence|sentences|outline|thesis|intro|introduction|conclusion|paragraph|topic sentence)\b|(that |which )?i can (just )?copy|just pretend|tell me a (dirty |funny )?joke)\b/i;
export function isSaidToCoach(spoken: string): boolean {
  const t = spoken.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (TO_COACH.test(t) && t.split(" ").length <= 40) return true;
  return rulesStanceIntent(t) !== "content";
}

/**
 * PC-29 QA round 3: the one place Stage 1 decides what the call says. The intake's plan can
 * re-shape under the same step while the brief loads (no north star yet → the hobby question;
 * the informed stance not saved yet → the lost-branch decision question), so a prompt is only
 * handed to the call once the on-screen line has held still for `settleMs` with no brief call in
 * flight (or for `maxMs`, whatever is still loading). Until then the call gets no prompt at all
 * (spoken ""), so the relay's question gate lets no question through, and nothing is said.
 */
export const VOICE_SETTLE = { settleMs: 900, maxMs: 8_000 } as const;

export type VoicePace = {
  /** The prompt the relay may treat as on screen right now ("" while it is still settling). */
  spoken: string;
  /** Say this line now (word for word), or nothing. */
  say: string | null;
  /** Look again in this many ms (still settling), or null. */
  wakeIn: number | null;
};

export class Stage1VoicePacer {
  private key: string | null = null;
  private line: string | null = null;
  private changedAt = 0;
  /** What the call already said for this step; line null = the call's own start line will say it. */
  private said: { key: string; line: string | null; base?: string; note?: string } | null = null;

  constructor(private readonly tune: { settleMs: number; maxMs: number } = VOICE_SETTLE) {}

  /** Voice turned off (or on again): the next look is a fresh start. */
  reset() {
    this.key = null;
    this.line = null;
    this.said = null;
  }

  /**
   * One look at the screen: `busy` = a brief call is in flight; `hold` = say nothing yet (a student
   * turn awaiting the app's reply); `hidden` = the line's question isn't rendered on the page.
   * `base`/`note` (PC-29d): the line without the app's note, and the note. When only the note is
   * new (a nudge on a prompt already said), only the note is said, never the whole prompt again.
   */
  step(i: { key: string; line: string; now: number; busy: boolean; hold?: boolean; hidden?: boolean; base?: string; note?: string }): VoicePace {
    const norm = (t: string) => t.replace(/\s+/g, " ").trim();
    const line = norm(i.line);
    const base = i.base !== undefined ? norm(i.base) : line;
    const note = i.note !== undefined && base !== line ? norm(i.note) : "";
    if (i.key !== this.key || line !== this.line) {
      this.key = i.key;
      this.line = line;
      this.changedAt = i.now;
    }
    const age = i.now - this.changedAt;
    // Its question isn't actually rendered on the page (a hidden plan item): never said, never "on screen".
    if (i.hidden) return { spoken: "", say: null, wakeIn: 250 };
    if (age < this.tune.settleMs) return { spoken: "", say: null, wakeIn: this.tune.settleMs - age };
    if (i.busy && age < this.tune.maxMs) return { spoken: "", say: null, wakeIn: Math.min(250, this.tune.maxMs - age) };
    // First settled look after voice came on: the relay's start line says this prompt itself.
    if (!this.said) this.said = { key: i.key, line: null };
    if (this.said.line === null && this.said.key === i.key) {
      if (line) this.said = { key: i.key, line, base, note };
      return { spoken: line, say: null, wakeIn: null };
    }
    if (i.hold || !line || (this.said.key === i.key && this.said.line === line)) return { spoken: line, say: null, wakeIn: null };
    // Same step, same prompt already said: only a new note (the nudge) is said; a cleared note says nothing.
    if (this.said.key === i.key && this.said.base === base) {
      const fresh = note && note !== this.said.note ? note : null;
      this.said = { key: i.key, line, base, note };
      return { spoken: line, say: fresh, wakeIn: null };
    }
    this.said = { key: i.key, line, base, note };
    return { spoken: line, say: line, wakeIn: null };
  }
}

/** Every question in the line shows in the page's text (whitespace and quotes normalized). */
export function questionsRendered(line: string, pageText: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[\u2018\u2019\u201c\u201d"'`]/g, "").replace(/[^a-z0-9?]+/g, " ").replace(/\s+/g, " ").trim();
  const page = norm(pageText);
  const qs = (line.match(/[^.!?]*\?/g) ?? []).map(norm).filter((q) => q.split(" ").length >= 3);
  return qs.every((q) => page.includes(q));
}

/* ---------------- PC-29d: side answers are spoken ---------------- */

const BACK_LINE = /^back to my question\b/i;

/**
 * What the call says for a side answer (an aside bubble): the answer's own words (the coaching
 * route already keeps them plain, short, labeled and never submission text), without links or
 * markdown, then a short way back. The on-screen prompt is never re-read in full.
 */
export function asideSpoken(paras: string[], maxChars = 1100): string {
  const clean = (t: string) =>
    t
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*_#`>]+/g, "")
      .replace(/^\s*[-•]\s+/gm, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  const back = paras.some((p) => BACK_LINE.test(p.trim()));
  let body = paras.filter((p) => !BACK_LINE.test(p.trim())).map(clean).filter(Boolean).join(" ");
  // Heading back to the on-screen prompt: one question at a time, so the answer's own question
  // (still in the bubble) isn't said before "back to your question".
  if (back) {
    const kept = (body.match(/[^.!?]+(?:[.!?]+["”’')\]]*|$)/g) ?? []).filter((x) => !/\?["”’')\]]*\s*$/.test(x.trim()));
    if (kept.join("").trim()) body = kept.join("").replace(/\s+/g, " ").trim();
  }
  if (body.length > maxChars) {
    const cut = body.slice(0, maxChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    body = end > maxChars / 3 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
  }
  if (!body) return "";
  return back ? `${body} Okay, back to your question.` : body;
}

/** A new aside bubble while voice is on (not ones restored, or already there when voice came on). */
export class AsideVoice {
  private seen: number | null | undefined = undefined;
  private wasOn = false;
  step(lastId: number | null, on: boolean): boolean {
    const fresh = on && this.wasOn && this.seen !== undefined && lastId !== null && lastId !== this.seen;
    this.seen = lastId;
    this.wasOn = on;
    return fresh;
  }
}

/** The line without the app's note (it leads the line, or trails it on the checklist). */
export function withoutNote(line: string, note: string): string {
  const l = line.replace(/\s+/g, " ").trim();
  const n = note.replace(/\s+/g, " ").trim();
  if (!n) return l;
  if (l.startsWith(n)) return l.slice(n.length).trim();
  if (l.endsWith(n)) return l.slice(0, l.length - n.length).trim();
  return l;
}
