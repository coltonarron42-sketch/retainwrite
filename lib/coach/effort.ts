/**
 * PC-31 (Colton t207u): reasoning effort per turn. "high" for research and
 * probing turns, "none" for quick acknowledgements and read-backs. A simple
 * classifier keyed on what the student said and the step they're on; the route
 * logs which one it used.
 */
import { isWriteRequest } from "@/lib/stages/stance-intent";

export type TurnIntent =
  | "ack"
  | "readback"
  | "write_request"
  | "research"
  | "summary"
  | "explain"
  | "interview"
  | "story"
  | "lost"
  | "probe"
  | "chat";

/**
 * "low" is the probing tier: measured on the PC-31 preview, grok-4.3 at "high" took 15 s+ on a plain
 * story/interview turn (over the chat's wait), so probing turns without tools run at "low" and research
 * turns (web search) keep "high". The realtime voice only takes high|none, so it maps low to none.
 */
export type Effort = "high" | "low" | "none";

/** Intent → effort and whether the server-side web search tool is offered. One table, easy to tune. */
export const EFFORT_TABLE: Record<TurnIntent, { effort: Effort; search: boolean }> = {
  ack: { effort: "none", search: false },
  readback: { effort: "none", search: false },
  write_request: { effort: "none", search: false },
  chat: { effort: "none", search: false },
  research: { effort: "high", search: true },
  summary: { effort: "high", search: true },
  explain: { effort: "low", search: false },
  interview: { effort: "low", search: false },
  story: { effort: "low", search: false },
  lost: { effort: "low", search: false },
  probe: { effort: "low", search: false },
};

const ACK = /^\s*(?:yes|yeah|yep|yup|sure|ok(?:ay)?|k|cool|thanks?|thank you|got it|sounds good|perfect|great|nice|right|no|nope|nah|looks good|that'?s right|correct)\b[\s.!,]*(?:thanks?|thank you|sounds good|let'?s go|do it)?[\s.!]*$/i;
export const RESEARCH =
  /\b(?:find|look up|search(?: for)?|research|dig up|pull up)\b[^.?!]{0,60}\b(?:examples?|sources?|studies|study|articles?|evidence|research|data|stats|leaders?|companies|cases?|info(?:rmation)?)\b|\b(?:examples? of|real[- ]world examples?|case stud(?:y|ies)|any sources?|sources? (?:for|on|about)|who(?:'s| is| are) (?:a |some )?(?:good |real |famous )?(?:examples?|leaders?))\b/i;
export const SUMMARY = /\b(?:summar\w*|catch me up|what do the readings say|key (?:ideas|points) (?:of|from|in) the (?:reading|chapter|article)s?|break down the (?:reading|chapter|article)s?)\b/i;
const EXPLAIN = /\b(?:what (?:is|are|does|do)|what'?s|explain|how (?:does|do|is)|why (?:does|do|is)|tell me about|difference between|meaning of)\b/i;
const LOST = /\b(?:idk|i don'?t know|no idea|i'?m (?:lost|stuck|confused)|this is (?:hard|confusing)|not sure)\b/i;
const INTERVIEW = /\b(?:interview me|ask me (?:some |a few )?questions|dig deeper|one (?:question )?at a time)\b/i;

export type ClassifyCtx = {
  /** The current step id or mode ("readback", "confirm", "interview", "story", ...). */
  step?: string | null;
  /** The typed route's mode, when the client already knows it. */
  mode?: string | null;
};

export function classifyTurn(text: string, ctx: ClassifyCtx = {}): { intent: TurnIntent; effort: Effort; search: boolean } {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  const words = t ? t.split(" ").length : 0;
  const pick = (intent: TurnIntent) => ({ intent, ...EFFORT_TABLE[intent] });
  const step = (ctx.step ?? "").toLowerCase();
  const mode = (ctx.mode ?? "").toLowerCase();
  if (/^(?:readback|confirm|read_back)/.test(step)) return pick("readback");
  if (t && words <= 6 && ACK.test(t)) return pick("ack");
  if (isWriteRequest(t) || mode === "reframe") return pick("write_request");
  if (mode === "research" || RESEARCH.test(t)) return pick("research");
  if (mode === "summary" || SUMMARY.test(t)) return pick("summary");
  if (mode === "interview" || INTERVIEW.test(t)) return pick("interview");
  if (mode === "story") return pick("story");
  if (mode === "lost" || (words <= 25 && LOST.test(t))) return pick("lost");
  if (mode === "answer" || (EXPLAIN.test(t) && /\?|^(?:explain|tell me)/i.test(t))) return pick("explain");
  if (mode === "vague") return pick("probe");
  if (words >= 40) return pick("story");
  if (words <= 3) return pick("chat");
  return pick("probe");
}

/** Which typed mode this turn really is: the client's guess, upgraded by what they actually asked. */
export function resolveMode<M extends string>(mode: M, intent: TurnIntent): M | "reframe" | "research" | "summary" {
  if (intent === "write_request") return "reframe";
  if (mode === "interview" || mode === "story") return mode;
  if (intent === "research") return "research";
  if (intent === "summary") return "summary";
  return mode;
}

/** The realtime voice takes "high" | "none" only. */
export const voiceEffort = (e: Effort): "high" | "none" => (e === "high" ? "high" : "none");
