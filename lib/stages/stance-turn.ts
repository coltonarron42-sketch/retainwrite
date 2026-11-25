/**
 * Stages 2 and 3 as Pau chat turns (PLAN.md 9). Pure helpers, so the
 * gates stay exactly what the old panels enforced:
 *
 * - `stanceTurnFor` decides which ONE turn Pau is on, from the same
 *   section state the old panels were shown from (one panel ⇔ one turn).
 * - `afterProbe` / `afterMirror` / `outlineSectionsForContinue` are the old
 *   inline transitions, lifted out unchanged.
 *
 * Pau only asks and reflects. Every note, outline line, and lead name in
 * the session is the student's own text.
 */
import { keptIdeas } from "@/lib/coaching/thin";
import { replaceClaim } from "@/lib/coaching/logicRevision";

export type StanceTurnKind =
  | "teach_card"
  | "mirror"
  | "probe"
  | "name_lead"
  | "pick_lead"
  | "confirm"
  | "logic_opener"
  | "logic_result"
  | "locked_in"
  | "none";

export type StanceTurnInput = {
  mode: "lesson" | "memory";
  loopStep: string;
  status: string;
  hasLogic: boolean;
  logicRevealed: boolean;
};

/**
 * Which turn is current. Mirrors the old render conditions one-for-one:
 * teach card (lesson + teach + card), mirror (memory + teach), probe,
 * search without directions (name your own), search with a batch (pick one),
 * summarize/confirm, logic opener (not yet revealed), logic result.
 */
export function stanceTurnFor(
  s: StanceTurnInput,
  opts: { hasCard: boolean; personalized: boolean; hasBatch: boolean },
): StanceTurnKind {
  if (s.loopStep === "teach") {
    if (s.mode === "lesson") return opts.hasCard ? "teach_card" : "none";
    return "mirror";
  }
  if (s.loopStep === "probe") return "probe";
  if (s.loopStep === "search") {
    if (!opts.personalized) return "name_lead";
    return opts.hasBatch ? "pick_lead" : "none";
  }
  if (s.loopStep === "summarize" || s.loopStep === "confirm") return "confirm";
  if (s.loopStep === "logic_check") {
    if (!s.hasLogic) return "none";
    return s.logicRevealed ? "logic_result" : "logic_opener";
  }
  if (s.status === "confirmed" || s.loopStep === "confirmed") return "locked_in";
  return "none";
}

/** The step after a saved probe idea (old "Save this idea"). */
export function afterProbe(
  section: { ideas: string[]; searchStatus: "required" | "not_needed" },
  idea: string,
  replacing: boolean,
): { ideas: string[]; loopStep: "summarize" | "search" } {
  const ideas = replacing ? replaceClaim(section.ideas, idea) : [...keptIdeas(section.ideas), idea];
  return { ideas, loopStep: section.searchStatus === "not_needed" ? "summarize" : "search" };
}

/** The step after the memory mirror (old "Save what it means to you"). */
export function afterMirror(section: { ideas: string[] }, idea: string): { ideas: string[]; loopStep: "probe" } {
  return { ideas: [...keptIdeas(section.ideas), idea], loopStep: "probe" };
}

/**
 * Old Stage 3 Continue: each section takes its outline draft, unless the draft
 * is blank or untouched (then the kept Stance ideas stay).
 */
export function outlineSectionsForContinue<T extends { key: string; ideas: string[] }>(
  sections: T[],
  drafts: Record<string, string | undefined>,
): T[] {
  return sections.map((item) => {
    const text = drafts[item.key]?.trim();
    if (!text || text === keptIdeas(item.ideas).join("\n")) return item;
    return { ...item, ideas: [text] };
  });
}

/** Stage 3: the next section to outline, one at a time; -1 when all are done. */
export function nextOutlineIndex(sections: { key: string }[], done: string[]): number {
  return sections.findIndex((s) => !done.includes(s.key));
}

/** A line of the Stage 2/3 conversation, kept on the session so a reload rebuilds it. */
/** "pick" is a tapped choice: shown as a small "Picked: …" chip, never as the student's words. */
export type LoopLine = { k: string; who: "pau" | "you" | "pick"; text: string };

export function appendLines(prev: LoopLine[] | undefined, lines: LoopLine[]): LoopLine[] {
  // Keep the saved session small: the last 80 lines are plenty to rebuild the chat.
  return [...(prev ?? []), ...lines.filter((l) => l.text.trim())].slice(-80);
}

/** Dedupe notes by normalized text, first spelling kept. */
function uniqueNotes(notes: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of notes) {
    const t = raw.trim();
    if (!t) continue;
    const k = t.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * A later lock-in or logic tap can close over a stale session (the second Body
 * note already saved, but the click still sees the first). Never drop a note
 * that was already kept, unless this is an explicit replace ("change it to").
 */
export function mergeSectionIdeas(current: string[] | undefined, incoming: string[] | undefined, replacing = false): string[] {
  if (replacing) return uniqueNotes(incoming ?? []);
  return uniqueNotes([...(current ?? []), ...(incoming ?? [])]);
}

export function mergeTranscript(current: LoopLine[] | undefined, incoming: LoopLine[] | undefined): LoopLine[] {
  const prev = current ?? [];
  const keyOf = (l: LoopLine) => `${l.k}\0${l.who}\0${l.text}`;
  const seen = new Set(prev.map(keyOf));
  const added: LoopLine[] = [];
  for (const l of incoming ?? []) {
    if (!l.text.trim()) continue;
    const k = keyOf(l);
    if (seen.has(k)) continue;
    seen.add(k);
    added.push(l);
  }
  return [...prev, ...added].slice(-80);
}

/** Apply a section patch on the latest session, so a stale click can't drop a just-saved note. */
export function applySectionPatch<T extends { sections: { key: string; ideas: string[] }[]; transcript?: LoopLine[] }>(
  latest: T,
  key: string,
  patch: Partial<T["sections"][number]>,
  extra?: Partial<T>,
  replacingIdeas = false,
): T {
  return {
    ...latest,
    ...extra,
    transcript: extra && "transcript" in extra ? mergeTranscript(latest.transcript, extra.transcript) : latest.transcript,
    sections: latest.sections.map((item) =>
      item.key === key
        ? {
            ...item,
            ...patch,
            ideas: patch.ideas ? mergeSectionIdeas(item.ideas, patch.ideas, replacingIdeas) : item.ideas,
          }
        : item,
    ) as T["sections"],
  };
}

/** Typed replies on a choice turn: a plain yes picks the main choice. */
const SPOKEN_YES_WORDS = new Set(
  "yes yeah yep yup ya sure ok okay alright lock it in looks sounds good great perfect lets let's go ahead do please that that's thats is right correct ready one i'm im happy with".split(" "),
);
const SPOKEN_YES_CORE = /\b(yes|yeah|yep|yup|sure|ok(ay)?|alright|lock it in|looks good|sounds good|let'?s go|go ahead|do it|perfect)\b/;
const SPOKEN_NO = /\b(no|not|don'?t|nope|wait|but|change|instead|actually|hold|stop|never)\b/;
/**
 * A clear spoken yes to a waiting choice ("Yes, lock it in", "yeah sounds
 * good"): short, only yes-words, no negation. Anything else is not a yes.
 * Grok Voice only; typed text keeps isPlainYes.
 */
export function isSpokenYes(text: string): boolean {
  const t = text.toLowerCase().replace(/[\u2019]/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\b(um+|uh+|so|like)\b/g, " ").trim();
  if (!t || SPOKEN_NO.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 8) return false;
  return words.every((w) => SPOKEN_YES_WORDS.has(w)) && SPOKEN_YES_CORE.test(t);
}

export function isPlainYes(text: string): boolean {
  return /^(y(es|ep|eah|up)?|sure|ok(ay)?|lock it in|looks good|sounds good|let'?s go|check it|go ahead|do it)[.!\s]*$/i.test(text.trim());
}

/**
 * A clear replacement of the saved note over a waiting choice ("change it to…",
 * "actually my point is…"). Returns the new note, or null. Anything else said
 * over a choice is discussion and never replaces the note (Colton 11:45 PM).
 * Same rule for typed and spoken words.
 */
const REPLACE_CUES: RegExp[] = [
  /^(?:(?:ok(?:ay)?|no|wait|hmm+|um+|uh+|so|actually)[,.!\s]+)*(?:can you |could you |please |let'?s |i want to |i'?d like to )?(?:change|switch|update|replace|swap|make) (?:it|that|this|my (?:note|point|idea|claim|answer)|the (?:note|point|idea|claim))(?: (?:to|with|for|into|so it says|so it'?s))[:,]?\s+(.+)$/i,
  /^(?:(?:ok(?:ay)?|no|wait|hmm+|um+|uh+|so)[,.!\s]+)*actually,?\s+(?:my (?:real |main )?(?:point|idea|claim|note|answer) is|what i (?:mean|meant|want to say) is|i (?:mean|meant))(?: that)?[:,]?\s+(.+)$/i,
  /^(?:(?:ok(?:ay)?|no|wait|so)[,.!\s]+)*(?:my (?:real |new )?(?:point|note|claim) (?:should be|is now)|instead,? (?:say|put|use|make it))[:,]?\s+(.+)$/i,
];
export function replacementText(text: string): string | null {
  const t = text.trim().replace(/[\u2019]/g, "'");
  for (const re of REPLACE_CUES) {
    const m = t.match(re);
    const note = m?.[1]?.trim().replace(/^["“]|["”]$/g, "").trim();
    if (note && note.split(/\s+/).length >= 3) return note.charAt(0).toUpperCase() + note.slice(1);
  }
  return null;
}

/** Yes to "Want me to swap that in?": a plain yes, or "yes, swap it". */
export function isSwapYes(text: string): boolean {
  if (isPlainYes(text)) return true;
  return /^(?:(?:y(?:es|ep|eah|up)?|sure|ok(?:ay)?|please)[,.!\s]*)*(?:please|swap it(?: in)?|do it|go ahead|use (?:that|it|the new one)|change it|yes please)?[.!\s]*$/i.test(text.trim()) && /\S/.test(text) && !/\b(no|not|don'?t|keep)\b/i.test(text);
}

/** No to the swap: keep the saved note. */
export function isSwapNo(text: string): boolean {
  return /^(?:no|nope|nah|never ?mind|keep (?:it|the (?:old|first|saved) one|my (?:old |first )?note)|leave it|don'?t)\b/i.test(text.trim());
}

export const SWAP_ASK = "Want me to swap that in?";

/** Her short reply when new words over a choice are discussion (the saved note stays). */
export function discussionLine(seed: number): string {
  const lines = [
    "Your saved note stays as it is. If you want it changed, say “change it to…” and I'll check with you first.",
    "I haven't changed your note. Say “change it to…” if you want that in instead.",
    "Your note is still the one above; tell me “change it to…” to swap it.",
  ];
  return lines[Math.abs(seed) % lines.length]!;
}

/**
 * QA 7:11 AM: a new reply with real content (8+ words, not a question, not a yes/no or a
 * "change it to…") over a waiting confirm is added to the note instead of turned away.
 */
export function substantiveNote(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (isPlainYes(t) || isSwapNo(t) || replacementText(t)) return false;
  if (/^(no|nope|nah|ok(?:ay)?|sure|thanks?|cool|idk|i don'?t know)\b[\s.!,]*$/i.test(t)) return false;
  return t.split(" ").filter((w) => /[a-z]/i.test(w)).length >= 8;
}
