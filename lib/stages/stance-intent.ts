/**
 * Is the student's message content for their paper, or something said TO the
 * coach? (QA 10:38: "Ask me some probing questions please." was saved as a
 * stance note, passed the logic check and was prefilled into Stage 3.)
 * A request or a question to Pau Pau is answered and is NEVER saved as a note.
 * The model decides when it can; these rules are the fallback and the fast path.
 * // SOP: coaching only, never generate submission text
 */
import { wordCount } from "@/lib/utils";
import { isContentQuestion } from "@/lib/coach/answer";

export type StanceIntent = "content" | "request_probe" | "request_help" | "question" | "content_question";

const PROBE =
  /\b(ask me|quiz me|probe me|probing questions?|(some|a few|more) questions|questions? (for|to) me|interview me|walk me through|you ask|can you ask|could you ask|give me (some )?questions)\b/i;
const HELP =
  /^(help|help me|i need help|can you help|could you help|please help|i'?m stuck|i am stuck|stuck|i (don'?t|do not) know (what|where|how)( to (say|write|start|put))?|not sure (what|where|how) to (say|write|start)|where do i start|how do i start|what (should|do) i (write|say|put)|you (pick|choose|decide)|just tell me|i have no idea|no idea|idk|i (still )?(don'?t|do not) know\b|i('?m| am) (lost|confused)|this is (hard|confusing|too hard))\b/i;
const QUESTION_TO_COACH =
  /^(what|huh|wait|sorry|um+|hm+)?[\s,]*(what (do|did) you mean|what does that mean|what does (this|that|it) mean|i (don'?t|do not) (get|understand)( it| this| that| the question)?|can you explain|could you explain|explain (that|this|please)|what('?s| is) (a|an|the) (lead|angle|logic check|section|probe|stance|outline)|what are you asking|what am i supposed to (do|write|say)|what should i do( here| now)?|do i (have to|need to)|is that (ok|okay|right)|why\??$|what\??$|huh\??$|meaning\??)/i;

/** "Can you just write my intro?": a request for their sentences. She declines warmly and coaches instead. */
export const WRITE_REQUEST =
  /\b(?:(?:can|could|would|will) you|please|just|pls)\b[^.?!]{0,30}\b(?:write|draft|do|make|finish|type)\b[^.?!]{0,25}\b(?:my|the|this|an?|it)\b[^.?!]{0,25}\b(?:intro(?:duction)?|paragraph|paper|essay|conclusion|thesis|section|sentence|outline|body|for me)\b|\bwrite (?:it|this|my \w+) for me\b/i;

export function isWriteRequest(text: string): boolean {
  return WRITE_REQUEST.test(text.replace(/\s+/g, " "));
}

/** Rule fallback. Long, substantive text is content even if it mentions "questions". */
export function rulesStanceIntent(text: string): StanceIntent {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "content";
  const words = wordCount(t);
  if (words > 30) return "content";
  if (QUESTION_TO_COACH.test(t) || isWriteRequest(t)) return "question";
  // A content or teaching question (QA 11/23: "what are the leadership styles?"): she answers it.
  if (isContentQuestion(t)) return "content_question";
  if (PROBE.test(t) && words <= 20) return "request_probe";
  if (HELP.test(t)) return "request_help";
  // A short question that is about the conversation, not the topic.
  if (/\?$/.test(t) && words <= 12 && /\b(you|your|pau ?pau|this section|this step|this question|here)\b/i.test(t) && !/\b(i think|i believe|my point)\b/i.test(t)) {
    return "question";
  }
  return "content";
}

/** Plain content needs no model call: longer statements with no coach cue. */
export function needsModel(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const rules = rulesStanceIntent(t);
  if (rules !== "content") return true;
  return wordCount(t) <= 14 || /\?\s*$/.test(t);
}

export const STANCE_INTENT_SYSTEM = `You classify ONE message a student typed into a writing coach's chat while working on a section of their paper.
Return "content" when the message is the student's own idea, claim, example, note or source for the paper (even if it is short, unsure, or phrased as a question about the TOPIC).
Return "request_probe" when they ask the coach to ask them questions or interview them.
Return "request_help" when they ask the coach for help, an example, or to choose/decide for them, or say they are stuck.
Return "question" when they ask the coach what something means or what to do (a question about the conversation, not the topic).
Return "content_question" when they ask the coach for facts, explanations or examples about the topic, the course material or how a good section/line works ("what are the leadership styles?", "examples of leaders?", "show me an example outline line").
Never write any of the paper. Answer only with JSON.`;

export const STANCE_INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { intent: { type: "string", enum: ["content", "request_probe", "request_help", "question", "content_question"] } },
  required: ["intent"],
} as const;

export function parseStanceIntent(raw: unknown): StanceIntent | null {
  const v = (raw as { intent?: unknown } | null)?.intent;
  return v === "content" || v === "request_probe" || v === "request_help" || v === "question" || v === "content_question" ? v : null;
}

/**
 * Final call: the rules win when they see a clear coach request (a model
 * "content" there would save a request as a note); otherwise the model wins.
 */
export function finalStanceIntent(model: StanceIntent | null, rules: StanceIntent): StanceIntent {
  if (rules !== "content") return rules;
  return model ?? rules;
}

export type IntentTurn = "teach_card" | "mirror" | "probe" | "name_lead" | "pick_lead" | "outline" | "choice";

/** Coaching questions for the section (never sentences for the paper). */
export function probingQuestions(section: { title: string; needs?: string | null }): string[] {
  const part = section.title.toLowerCase();
  if (/intro/.test(part)) {
    return [
      "What's the one thing a reader should know before your argument starts?",
      "What's your answer to the prompt, in one plain sentence?",
      "What moment, fact or example could pull a reader in?",
    ];
  }
  if (/conclu/.test(part)) {
    return [
      "If a reader remembers one thing from your paper, what should it be?",
      "Why does your answer matter beyond this class?",
      "What question does your paper leave open?",
    ];
  }
  return [
    `What's the main point your ${part} has to prove?`,
    "What example, source or moment shows it best?",
    "What would someone who disagrees say, and how would you answer?",
  ];
}

/** Her ask under the probing questions she just gave (replaces the opening ask, so it isn't repeated). */
export const ASIDE_FOLLOW_UP = "Answer one of those in your own words, or tell me the idea you already have.";

/** Stage 3: her ask after an answer (the opener isn't repeated). */
export const OUTLINE_FOLLOW_UP = "When you're ready, put your notes into short outline lines in the box, or tap Keep my notes.";

/** Her next ask after any aside, so the opener question is never repeated. */
export function asideFollowUp(intent: StanceIntent | undefined, sectionTitle: string): string {
  if (intent === "request_probe" || intent === "request_help") return ASIDE_FOLLOW_UP;
  return `When you're ready, tell me your idea for your ${sectionTitle.toLowerCase()} in your own words.`;
}

/** Pau Pau's reply to a request or question. It rides inside her current turn. */
export function intentReply(intent: StanceIntent, ctx: { turn: IntentTurn; section: { title: string; needs?: string | null }; text?: string }): string[] {
  if (ctx.text && isWriteRequest(ctx.text)) {
    const part = ctx.section.title.toLowerCase();
    return [`That part's yours to write, and it'll sound like you because of it. I'll help you figure out what your ${part} says, though. ${probingQuestions(ctx.section)[1] ?? "What's your main point here?"}`];
  }
  const qs = probingQuestions(ctx.section);
  const list = qs.map((q, i) => `${i + 1}. ${q}`).join(" ");
  switch (intent) {
    case "request_probe":
      return [`Sure. A few questions for your ${ctx.section.title.toLowerCase()}. Pick any one and answer it in your own words: ${list}`];
    case "request_help":
      return [`Happy to help. Start small: you don't need the whole section, just one idea. Try one of these: ${list}`];
    case "question": {
      const what =
        ctx.turn === "name_lead" || ctx.turn === "pick_lead"
          ? "I'm asking which source, person or example you want to look into for this section. You'll check it yourself later."
          : ctx.turn === "choice"
            ? `I'm checking that you're happy with this idea for your ${ctx.section.title.toLowerCase()}. Tap one of the choices in my message to keep going; you can change it later.`
          : ctx.turn === "outline"
            ? "I'm asking you to put your notes for this section into short outline lines, one point per line, in your own words."
            : `I'm asking what you want your ${ctx.section.title.toLowerCase()} to say. One or two sentences in your own words is plenty.`;
      return [`${what} If you'd like, say "ask me questions" and I'll walk you through it.`];
    }
    case "content_question":
      return ["I couldn't pull my answer together just now. Ask me again in a sec, or tell me what you already know about it."];
    default:
      return [];
  }
}
