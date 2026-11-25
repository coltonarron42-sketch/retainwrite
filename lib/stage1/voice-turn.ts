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
export type Stage1VoiceScreen = { key: string; text: string; choices: string[]; spoken: string };

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
  return { ...v, spoken: stage1Spoken(s) };
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

function stage1VoiceScreenText(s: Parameters<typeof stage1VoiceScreen>[0]): Omit<Stage1VoiceScreen, "spoken"> {
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
