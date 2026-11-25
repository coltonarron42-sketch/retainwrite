/**
 * t204u (Colton, live test): a student who already told a concrete story and named a style
 * ("…my manager Mandy… She was truly a servant leader.") is reflected back, with the link named in
 * plain words, then ONE next move with an easy yes. Never a list of new questions.
 * // SOP: coaching only, never generate submission text
 */
import { namedPerson, stylesIn } from "@/lib/stage1/north-turns";

export type StoryReflect = { style: string; who: string; named: boolean; actions: string[]; tentative: boolean };

const ROLE = "manager|boss|supervisor|coach|teacher|mentor|team lead|team leader|lead|director|captain|principal|professor|pastor|sergeant|shift lead|store manager|general manager|owner";
const ROLE_RE = new RegExp(`\\b(?:my|our)\\s+(?:old\\s+|former\\s+|first\\s+)?(${ROLE})\\b(?:\\s*,?\\s*(?:named\\s+)?([A-Z][a-z]{2,}))?`, "i");

/** Plain meaning of each style, in the student's register. */
export const STYLE_MEANING: Record<string, string> = {
  servant: "putting your people's growth and needs first",
  transformational: "inspiring people toward a shared vision and helping them grow into it",
  situational: "changing how you lead to fit what each person needs",
  authentic: "leading from your real values, out in the open",
  democratic: "bringing the team into the decisions",
  participative: "bringing the team into the decisions",
  transactional: "clear goals, with rewards and consequences tied to them",
  charismatic: "pulling people in with energy and conviction",
  autocratic: "making the calls yourself, fast",
  adaptive: "helping people work through hard change",
  visionary: "setting a clear picture of where the team is going",
  coaching: "growing each person's skills one on one",
};

/** Hints for a style when they told a story but didn't name one (the tentative direction). */
const STYLE_HINTS: [string, RegExp][] = [
  ["servant", /\b(put (?:us|people|the team|her team|his team) first|cared|took care of|one-on-ones?|1:1s?|coached|mentored|promot\w+|covered (?:for|shifts?)|listened|helped (?:us|me|everyone)|served)\b/i],
  ["transformational", /\b(vision|inspired|inspiring|bought in|believe in|big picture|motivated)\b/i],
  ["situational", /\b(adapted|adjusted|depending on|each person differently|flexed)\b/i],
];

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const PAST = /\b(?:\w{3,}ed|was|were|had|did|made|took|gave|held|ran|led|kept|got|went|told|taught|helped|knew|met|brought|built|stayed|would)\b/gi;

/** Who the story is about: "Mandy" (from "my manager Mandy"), a named person, or "your manager". */
export function storyWho(text: string): { who: string; named: boolean } | null {
  const m = text.match(ROLE_RE);
  if (m?.[2]) return { who: m[2], named: true };
  const p = namedPerson(text);
  if (p && !/^(T-Mobile|Walmart|Target|Starbucks|Amazon|Google|Microsoft|Apple)$/i.test(p)) return { who: p, named: true };
  if (m?.[1]) return { who: `your ${m[1].toLowerCase()}`, named: false };
  return null;
}

/** A real story of their own: a person, things that happened (past tense), and some length. */
export function isRichStory(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (words(t) < 30) return false;
  if ((t.match(PAST) ?? []).length < 3) return false;
  return Boolean(storyWho(t)) || /\b(when I|I worked|I was working|at my (?:job|work)|my job)\b/i.test(t);
}

/** Up to two things the person did, in their own past tense ("held weekly one-on-ones with every rep"). */
export function storyActions(text: string, who: string): string[] {
  const name = who.replace(/^your\s+/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const subj = new RegExp(`\\b(?:she|he|they|${name})\\s+(?:also\\s+|always\\s+|would\\s+(?:always\\s+)?|really\\s+|even\\s+)?([a-z]+)\\s+([^.!?;]*)`, "gi");
  const VERB = /^(?:[a-z]{2,}ed|held|made|took|gave|ran|led|kept|got|taught|brought|built|met|sat|put|set|let|paid|stayed)$/i;
  const out: string[] = [];
  const tidy = (rest: string) =>
    rest
      .split(/\s+(?:when|while|because|since|so that|which|until|after|before)\b/i)[0]!
      .split(/\s+/)
      .slice(0, 7)
      .join(" ")
      .replace(/[,;:]+$/, "")
      .replace(/(?:\s+(?:and|but|so|to|the|a|an|with|of|for|on|in|at|from|by|every|each))+$/i, "")
      .replace(/\b(us|we)\b/gi, "people")
      .replace(/\bour\b/gi, "the")
      .replace(/\bme\b/gi, "you")
      .replace(/\bmy\b/gi, "your")
      .replace(/\bherself\b|\bhimself\b|\bthemselves\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  for (const m of text.replace(/\s+/g, " ").matchAll(subj)) {
    const verb = m[1]!;
    if (!VERB.test(verb) || /^(seemed|felt|became|said|wanted|started|tried|used|needed)$/i.test(verb)) continue;
    const clause = m[2]!;
    if (stylesIn(clause).length || /\b(leader|leadership)\b/i.test(clause)) continue;
    // "coached people toward promotions and covered the shifts": two actions.
    const parts = clause.split(/,?\s+and\s+(?=(?:[a-z]{2,}ed|held|made|took|gave|ran|led|kept|got|taught|brought|built)\b)/i);
    out.push(`${verb.toLowerCase()} ${tidy(parts[0]!)}`.trim());
    for (const more of parts.slice(1)) {
      const [v, ...r] = more.trim().split(/\s+/);
      if (out.length < 3 && v) out.push(`${v.toLowerCase()} ${tidy(r.join(" "))}`.trim());
    }
    if (out.length >= 3) break;
  }
  return out.slice(0, 2);
}

/** The reflect-back, or null when it isn't a story with a style (named, or a clear hint when tentative is ok). */
export function reflectStory(text: string, opts: { tentative?: boolean } = {}): StoryReflect | null {
  const t = text.replace(/\s+/g, " ").trim();
  const who = storyWho(t);
  if (!who) return null;
  const named = stylesIn(t).find((s) => STYLE_MEANING[s]);
  const hinted = named ? null : opts.tentative ? STYLE_HINTS.find(([, re]) => re.test(t))?.[0] ?? null : null;
  const style = named ?? hinted;
  if (!style) return null;
  return { style, who: who.who, named: who.named, actions: storyActions(t, who.who), tentative: !named };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const proof = (r: StoryReflect) => r.who;

/** Her reply: the link in plain words, then one next move and why, as one easy-yes question. */
export function reflectParas(r: StoryReflect, opts: { lead?: string } = {}): string[] {
  const meaning = STYLE_MEANING[r.style] ?? "how you lead people";
  const acts = r.actions.length > 0;
  const link = acts
    ? `${cap(proof(r))} ${r.actions.join(" and ")}. That's classic ${r.style} leadership: ${meaning}.`
    : `That story is classic ${r.style} leadership: ${meaning}.`;
  const move = r.tentative
    ? `Here's a direction to try: ${r.style} leadership, with ${proof(r)} as your proof, since your story already shows it. Want to run with it?`
    : `That's a solid direction: ${r.style} leadership, with ${proof(r)} as your proof. Your story already does the heavy lifting. Want to run with it?`;
  return [opts.lead ? `${opts.lead} ${link}` : link, move];
}

/** Their reply to the proposal. */
export function proposalReply(text: string): "yes" | "no" | "interview" | "summary" | "confused" | "other" {
  const t = text.trim();
  if (/\b(interview me|you said you'?d interview|ask me (?:some |a few )?questions|one (?:question )?at a time)\b/i.test(t)) return "interview";
  if (/\b(summar\w*|catch me up|haven'?t read|didn'?t read|not read (?:it|them)|what do the readings say|key ideas)\b/i.test(t)) return "summary";
  if (/^\s*(yes|yeah|yep|yup|sure|ok(?:ay)?|sounds good|let'?s do (?:it|that)|let'?s go|run with it|that works|perfect|great|do it)\b/i.test(t) || /\brun with it\b/i.test(t)) return "yes";
  if (/^\s*(no|nope|nah|not quite|not really)\b/i.test(t)) return "no";
  if (/\b(i don'?t (?:get|understand)|confus\w*|what do you mean|build on (?:my|the) story|use my story|connect it)\b/i.test(t)) return "confused";
  return "other";
}

/** The ask a student makes to build on their story / be interviewed, before any proposal exists. */
export function wantsStoryHelp(text: string): boolean {
  return proposalReply(text) === "interview" || proposalReply(text) === "confused";
}
