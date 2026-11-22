import { PAU_PERSONALITY } from "@/lib/coach/personality";
/**
 * Hesitation "spark" questions: 2–3 short, open, Socratic questions about the
 * student's own topic and experience. Never suggested sentences, wording or
 * content. // SOP: coaching only, never generate submission text
 */
import { assertCoachingOnly } from "@/lib/ai/guard";

export const SPARK_OFFER = "Want me to ask a couple questions that might spark something?";
export const HESITATION_IDLE_MS = 25_000;
export const HESITATION_DELETE_SETTLE_MS = 2_000;

/** Deleted most of what they wrote (they had at least a sentence's worth). */
export function isHeavyDelete(maxLen: number, currentLen: number): boolean {
  return maxLen >= 25 && currentLen <= maxLen * 0.35;
}

export type SparkKind = "interest" | "coaching" | "personal" | "stance" | "other";

export function sparkKind(questionId: string, kind?: string): SparkKind {
  if (questionId === "stance_early") return "stance";
  if (kind === "interest" || kind === "coaching" || kind === "personal") return kind;
  return "other";
}

const FALLBACK: Record<SparkKind, string[]> = {
  interest: [
    "What do you end up talking about with friends when nobody's assigning anything?",
    "What could you explain to someone for ten minutes without notes?",
    "What do you watch, read, or play when you get to choose?",
  ],
  coaching: [
    "If a friend asked what this assignment wants, what would you tell them in one breath?",
    "Which part of the prompt feels most important to you?",
    "What do you think your teacher hopes you'll figure out?",
  ],
  personal: [
    "Was there a moment, even a small one, when this topic touched your own life?",
    "Who do you know who'd have a strong opinion on this, and what would they say?",
    "What have you noticed about this at school, at work, or at home?",
  ],
  stance: [
    "What's your gut reaction to this topic, before you think too hard?",
    "What would someone who disagrees with you say first?",
    "What experience of yours makes you lean the way you do?",
  ],
  other: [
    "What's the first thing that comes to mind when you think about this topic?",
    "Where have you run into this topic in your own life?",
    "What part of it do you care about most, and why?",
  ],
};

export function fallbackSparkQuestions(kind: SparkKind): string[] {
  return FALLBACK[kind];
}

// Phrases that hand the student wording or content instead of asking.
const SUGGESTS = [
  /\byou (?:could|might|should|can) (?:write|say|argue|mention|start|use|begin)\b/i,
  /\btry (?:writing|saying|starting|using)\b/i,
  /\bfor example\b|\be\.g\.|\bsuch as\b/i,
  /\bhere(?:'s| is)\b/i,
  /\b(?:thesis|sentence|paragraph|opening line|topic sentence)\b/i,
  /\bwhat if you (?:wrote|said)\b/i,
];

/** Keep only short, open questions; null if fewer than 2 survive. */
export function validateSparkQuestions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const q = item.replace(/\s+/g, " ").trim();
    if (!q.endsWith("?")) continue;
    if (q.split(" ").length > 25 || q.length > 180) continue;
    if (/[“”"]/.test(q)) continue;
    if ((q.match(/\?/g) ?? []).length > 1) continue;
    if (SUGGESTS.some((re) => re.test(q))) continue;
    if (!assertCoachingOnly(q).ok) continue;
    out.push(q);
    if (out.length === 3) break;
  }
  return out.length >= 2 ? out : null;
}

export const SPARK_SYSTEM = [
  "You are Pau Pau, a warm writing coach for students. The student is stuck answering one of your questions.",
  "Ask 2 or 3 short, open, Socratic questions (each under 20 words) about THEIR OWN experience, memories, opinions and noticing.",
  "The questions must help them answer the exact question they are stuck on. Use the assignment topic only when that question is about the topic (for a question about their hobbies or interests, ask about their life, not the assignment).",
  "Never suggest sentences, wording, claims, examples, facts, a thesis, or what to write. Never answer for them. No quotation marks.",
  "Each item is one question ending in a question mark. Plain, friendly, high-school reading level.",
  PAU_PERSONALITY,
  "Here the questions themselves carry the coaching; a light, kind touch of humor is fine in at most one of them.",
  'Return JSON: {"questions": ["...", "..."]}.',
].join("\n");

export function sparkUserPrompt(input: {
  questionText: string;
  topic?: string;
  interests?: string[];
}): string {
  return [
    `Your question they're stuck on: ${input.questionText}`,
    input.topic ? `Their assignment topic: ${input.topic}` : null,
    input.interests?.length ? `Things they said they enjoy: ${input.interests.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
