/**
 * Stage 1 on Grok Voice (Colton t159u, Nov 23): what the app shows right now,
 * as data for Pau Pau on the call, and how spoken words join the answer box.
 * The student's spoken words are their verbatim transcript; nothing the model
 * says is ever written into an answer (the voice sample stays theirs).
 */
import { rulesStanceIntent } from "@/lib/stages/stance-intent";

export type Stage1VoiceScreen = { key: string; text: string; choices: string[] };

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
}): Stage1VoiceScreen {
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

/** Requests and jailbreaks said TO Pau Pau ("write it for me", "ignore your rules"): never part of an answer. */
const TO_COACH =
  /\b(ignore (your|the|all|any|previous) (rules|instructions)|pretend (you'?re|you are|to be)|you are now|act as|jailbreak|no limits|developer mode|(write|do|make|finish|give me) (it|this|that|my|the|an?)\b[^.?!]{0,40}\bfor me|write (my|the|an?) (whole |entire |full )?(answer|take|essay|paper|intro|introduction|paragraph|story|angle)|tell me a (dirty |funny )?joke)\b/i;
export function isSaidToCoach(spoken: string): boolean {
  const t = spoken.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (TO_COACH.test(t) && t.split(" ").length <= 40) return true;
  return rulesStanceIntent(t) !== "content";
}
