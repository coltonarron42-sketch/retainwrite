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

/** Spoken filler ("uh", "um", "you know") out, so detection reads the story, not the hesitations. */
export function withoutSpokenFiller(text: string): string {
  return text
    .replace(/,\s*(?:u+h+|u+m+|e+r+m*)\s*,/gi, " ")
    .replace(/(^|[\s,.;])(?:u+h+|u+m+|e+r+m*|hmm+|uh-huh)(?=[\s,.;!?]|$)[,]?/gi, "$1")
    .replace(/,\s*you know,?/gi, ",")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const NOT_WHO =
  /^(I|Okay|Ok|So|And|But|If|We|She|He|They|It|Our|The|This|That|There|Then|When|Once|Honestly|Yeah|Yes|No|Maybe|Sorry|Can|Uh|Um|Doesn|Like|Well|Also|Her|His|My|Mr|Mrs|Ms|T-Mobile|Mobile|Walmart|Target|Starbucks|Amazon|Google|Microsoft|Apple|Costco|Verizon|Best|Buy|Servant|Transformational|Situational|Leadership|Monday|Friday)$/;
const ROLE_WORD = "leader|manager|boss|supervisor|mentor|coach|lead|director|teacher|captain|principal|professor|pastor|sergeant|owner";

/** Who the story is about: "Mandy" (from "my manager Mandy" or "an incredible leader, uh, Mandy, who…"), a named person, or "your manager". */
export function storyWho(text0: string): { who: string; named: boolean } | null {
  const text = withoutSpokenFiller(text0);
  const m = text.match(ROLE_RE);
  if (m?.[2] && !NOT_WHO.test(m[2])) return { who: m[2], named: true };
  const ok = (n?: string) => (n && !NOT_WHO.test(n) ? n : null);
  // "a leader, Mandy, who…", "my boss named Dave", "leader called Ana"
  for (const r of text.matchAll(new RegExp(`\\b(?:${ROLE_WORD})s?\\s*,?\\s*(?:named\\s+|called\\s+|was\\s+)?([A-Z][a-z]{2,})\\b`, "g"))) {
    if (ok(r[1])) return { who: r[1]!, named: true };
  }
  // "Mandy, who used to…", "Mandy was my manager", "the Mandy story"
  for (const r of text.matchAll(/\b([A-Z][a-z]{2,})(?:,?\s+who\b|\s+was\s+(?:my|our)\b)/g)) if (ok(r[1])) return { who: r[1]!, named: true };
  for (const r of text.matchAll(/\bthe\s+([A-Z][a-z]{2,})\s+story\b/g)) if (ok(r[1])) return { who: r[1]!, named: true };
  const p = namedPerson(text);
  if (p && !p.split(/\s+/).some((w) => NOT_WHO.test(w))) return { who: p, named: true };
  if (m?.[1]) return { who: `your ${m[1].toLowerCase()}`, named: false };
  return null;
}

/** A real story of their own: a person, things that happened (past tense), and some length. */
export function isRichStory(text: string): boolean {
  const t = withoutSpokenFiller(text.replace(/\s+/g, " ").trim());
  if (words(t) < 30) return false;
  if ((t.match(PAST) ?? []).length < 3) return false;
  return Boolean(storyWho(t)) || /\b(when I|I worked|I was working|at my (?:job|work)|my job)\b/i.test(t);
}

/** Up to two things the person did, in their own past tense ("held weekly one-on-ones with every rep"). */
export function storyActions(text: string, who: string): string[] {
  const name = who.replace(/^your\s+/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const subj = new RegExp(`\\b(?:she|he|they|${name})\\s+(?:(?:also|always|actually|just|would|really|even|often)\\s+)*([a-z]+)\\s+([^.!?;]*)`, "gi");
  const VERB = /^(?:[a-z]{2,}ed|held|made|took|gave|ran|led|kept|got|taught|brought|built|met|sat|put|set|let|paid|stayed|found|broke|showed)$/i;
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
  const clean = withoutSpokenFiller(text.replace(/\s+/g, " "));
  // "Mandy, who used to take everybody's time and requests seriously": what they did, in past tense.
  const PAST_OF: Record<string, string> = { take: "took", give: "gave", hold: "held", make: "made", keep: "kept", find: "found", run: "ran", lead: "led", teach: "taught", bring: "brought", build: "built", meet: "met", put: "put", let: "let", pay: "paid" };
  const whoRe = new RegExp(`\\b${name},?\\s+who\\s+(?:used to|would)\\s+([a-z]+)\\s+([^.!?;]*)`, "i");
  const wm = clean.match(whoRe);
  if (wm) {
    const v = wm[1]!.toLowerCase();
    const past = PAST_OF[v] ?? (v.endsWith("e") ? `${v}d` : `${v}ed`);
    out.push(`${past} ${tidy(wm[2]!.replace(/\s+/g, " "))}`.trim());
  }
  const clauses = clean.split(/[.!?;]|,\s+(?=(?:she|he|they|and|but|when|if)\b)/i);
  for (const m of clauses.flatMap((c) => [...c.matchAll(subj)])) {
    const verb = m[1]!;
    if (!VERB.test(verb) || /^(seemed|felt|became|said|wanted|started|tried|used|needed|seen|explained)$/i.test(verb)) continue;
    const clause = m[2]!;
    if (stylesIn(clause).length || /\b(leader|leadership)\b/i.test(clause)) continue;
    // "coached people toward promotions and covered the shifts": two actions.
    const parts = clause.split(/,?\s+(?:and|but)\s+(?=(?:[a-z]{2,}ed|held|made|took|gave|ran|led|kept|got|taught|brought|built|broke|found)\b)/i);
    out.push(`${verb.toLowerCase()} ${tidy(parts[0]!)}`.trim());
    for (const more of parts.slice(1)) {
      const [v, ...r] = more.trim().split(/\s+/);
      if (out.length < 3 && v) out.push(`${v.toLowerCase()} ${tidy(r.join(" "))}`.trim());
    }
    if (out.length >= 3) break;
  }
  // The two that show the most about how they led (growth, listening, real responsibility), in story order.
  const strong = /\b(gave|coached|promot\w*|one-on-ones?|listened|seriously|mentored|cared|develop\w*|grow\w*|responsibilit\w*)\b/i;
  const ranked = out.map((a, i) => ({ a, i, s: strong.test(a) ? 0 : 1 })).sort((x, y) => x.s - y.s || x.i - y.i).slice(0, 2).sort((x, y) => x.i - y.i);
  return ranked.map((x) => x.a);
}

/** The reflect-back, or null when it isn't a story with a style (named, or a clear hint when tentative is ok). */
export function reflectStory(text: string, opts: { tentative?: boolean } = {}): StoryReflect | null {
  const t = withoutSpokenFiller(text.replace(/\s+/g, " ").trim());
  const who = storyWho(t);
  if (!who) return null;
  // QA 12:48: the style they name themselves ("She was truly a servant leader") always wins.
  const named = stylesIn(t).find((s) => STYLE_MEANING[s]) ?? (Object.keys(STYLE_MEANING).find((s) => new RegExp(`\\b${s}\\s+(?:leader|leadership|style|type)\\b`, "i").test(t)) ?? undefined);
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
  const t = withoutSpokenFiller(text.trim());
  const n = words(t);
  if (/\b(interview(?:ing)? me|interview\b|you said you'?d interview|ask me (?:some |a few )?questions|one (?:question )?at a time|dig deeper)\b/i.test(t)) return "interview";
  if (/\b(summar\w*|catch me up|haven'?t (?:really )?read|didn'?t read|not read (?:it|them)|what do the readings say|key ideas)\b/i.test(t)) return "summary";
  // A yes is short ("Yes", "Okay, let's do it"); a long message that opens with "Okay, so…" is a story, not a yes.
  if ((n <= 8 && /^\s*(yes|yeah|yep|yup|sure|ok(?:ay)?|sounds good|let'?s do (?:it|that)|let'?s go|run with it|that works|perfect|great|do it)\b/i.test(t)) || (n <= 12 && /\brun with it\b/i.test(t))) return "yes";
  if (n <= 10 && /^\s*(no|nope|nah|not quite|not really)\b/i.test(t)) return "no";
  if (/\b(i don'?t (?:get|understand)|no idea what|(?:doesn'?t|does not|don'?t) (?:seem to )?make (?:any )?sense|confus\w*|what do you mean|build on (?:my|the|this)(?: \w+)? story|use my story|connect it|how (?:it|they|these) relate)\b/i.test(t)) return "confused";
  return "other";
}

/** The ask a student makes to build on their story / be interviewed, before any proposal exists. */
export function wantsStoryHelp(text: string): boolean {
  return proposalReply(text) === "interview" || proposalReply(text) === "confused";
}

/**
 * QA 12:48 (a): "summarize the readings" while their story is on the table: 3–5 plain bullets in total
 * (their pages when uploaded, otherwise clearly general background), tied back to their story,
 * then at most one ask. No page or chapter details she doesn't have. Teaching only, never paper text.
 */
export function storySummaryParas(
  summaries: { kind: string; title: string; points: string[] }[],
  r: StoryReflect | null,
): string[] {
  const own = summaries.filter((s) => s.kind === "reading" || s.kind === "found");
  const use = own.length ? own : summaries;
  const bullets: string[] = [];
  for (let i = 0; bullets.length < 4 && i < 6; i++) {
    for (const s of use) {
      const p = s.points[i];
      if (p && bullets.length < 4) bullets.push(`• ${p.replace(/\s+/g, " ").trim()}`);
    }
  }
  if (bullets.length < 3) {
    for (const b of [
      "• Leadership is about influencing a group toward a shared goal, not just holding a title.",
      "• Different styles move people in different ways: some sell a vision, some adapt to the person, some put the team's needs first.",
      "• Leading through change works best when people trust the leader and understand why the change matters.",
    ]) if (bullets.length < 3) bullets.push(b);
  }
  const lead = own.length
    ? "Here are the key ideas from your readings, in plain words:"
    : "I don't have your copies yet, so this is general background, not from your chapters:";
  const out = [lead, ...bullets];
  if (!own.length) out.push("If you upload your pages later, I'll match your exact text.");
  if (r) {
    const meaning = STYLE_MEANING[r.style] ?? "how you lead people";
    out.push(`How it connects to your story: ${cap(r.who)} is the ${r.style} idea in action, ${meaning}.`);
    out.push(`Want to run with ${r.style} leadership, with ${r.who} as your proof?`);
  } else {
    out.push("Which of these sounds closest to a leader you've seen?");
  }
  return out;
}
