/**
 * Pau answering content/teaching questions in typed Stages 1-3 (QA 11/23):
 * the shared prompt and output cleanup. Coaching only: never their sentences.
 * // SOP: coaching only, never generate submission text
 */
import { dropBarePraise, stripHollowPraise, stripReadingRefusal } from "@/lib/stage1/paper-context";

import { pauTextSystem, type PauTextMode } from "@/lib/coach/pau-prompt";

/** PC-31: the typed modes Pau answers in (Colton t207u prompt). */
export type CoachAnswerMode = PauTextMode;

/** PC-31: the system prompt for one typed turn (Colton's Role/Objective/Flow/Guardrails/Voice + house rules + this mode). */
export function coachAnswerSystem(mode: CoachAnswerMode, o: { plain?: boolean } = {}): string {
  return pauTextSystem(mode, o);
}

/** The "answer" mode prompt (kept as a constant for callers and tests). */
export const COACH_ANSWER_SYSTEM = coachAnswerSystem("answer");

/**
 * PC-31: clean a typed Pau reply. Bullets stay their own items ("• "), up to 8
 * items (2-4 research options or 3-5 summary bullets plus a lead and the ask).
 */
export function cleanPauParas(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map((p) => String(p ?? "")) : typeof raw === "string" ? raw.split(/\n+/) : [];
  return list
    .flatMap((p) => p.split(/\n+/))
    .map((p, i) => (i === 0 ? stripHollowPraise(dropBarePraise(p)) : p))
    .map((p) =>
      stripReadingRefusal(
        p
          .replace(/^\s*(?:[-*–]|\d{1,2}[.)])\s+/, "• ")
          .replace(/[*#_`]+/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    )
    .map(joinSpacedDomains)
    .filter((p) => p.length > 0 && p.length <= 900 && p !== "•")
    .slice(0, 8);
}

/** "sagepub. com" / "hbr . org's" → "sagepub.com" / "hbr.org's" (a site name the model spaced out to avoid a link). */
export function joinSpacedDomains(p: string): string {
  return p.replace(/\b([A-Za-z0-9-]{2,})[\s\u00a0\u200b]*\.[\s\u00a0\u200b]+(com|org|edu|net|gov|io|co|uk|ca|au)\b/g, "$1.$2");
}

export function cleanCoachAnswer(raw: unknown, ctx?: { mode?: CoachAnswerMode; message?: string }): string[] {
  if (!Array.isArray(raw)) return [];
  // QA 7:11 AM: praise has to name something specific, so a bare leading "Nice." / "That tracks." always goes.
  void ctx;
  return raw
    .map((p, i) => (i === 0 ? stripHollowPraise(dropBarePraise(String(p ?? ""))) : String(p ?? "")))
    .map((p) => stripReadingRefusal(String(p ?? "").replace(/[*#_`]+/g, "").replace(/\s+/g, " ").trim()))
    .filter((p) => p.length > 0 && p.length <= 900)
    .slice(0, 3);
}

/**
 * A vague note: hedged, generic, and short, with nothing specific in it
 * ("a good leader should be nice to people i guess"). Pushed once per section.
 */
export function isVagueNote(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean);
  if (words.length >= 25) return false;
  const hedge = /\b(i guess|i think|maybe|idk|i don'?t know|kind of|kinda|sort of|stuff|things|whatever|probably|something like)\b/i.test(t);
  const specific = /\b[A-Z][a-z]{2,}\b/.test(t.replace(/^\S+/, "")) || /\d/.test(t) || /["“]/.test(t) || /\b(because|since|for example|like when|such as)\b/i.test(t);
  if (specific) return false;
  return hedge || words.length < 8;
}

/** A content/teaching question to the coach, not their idea (rules fast path). */
const CONTENT_Q =
  /(^|[.!?]\s+)(what|who|which|how|why)\b[^.!?]{3,}\?|\b(examples? of|give me (an |some )?examples?|show me (an |some )?examples?|an example (outline )?(line|sentence)|what does a good|what makes a good|tell me about|explain (what|how|the|to me))\b/i;

export function isContentQuestion(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.split(" ").length > 30) return false;
  // Their own claim phrased with a question mark ("maybe leaders should listen?") stays content.
  if (/\b(i think|i believe|my point|my idea|i'?d argue)\b/i.test(t)) return false;
  return CONTENT_Q.test(t);
}
