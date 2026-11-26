import { dropHedges } from "@/lib/copy/tidy";
/**
 * Stage 2 opener and carry-over (QA 6:03 AM): the plain-words assignment from
 * the read-back as the teach line, the actual decision and reason from Stage 1
 * (never "idk"), and the Stage 1 options reused when they ask for options.
 * // SOP: coaching only, never generate submission text
 */
import { chosenStyles, namedPerson } from "@/lib/stage1/north-turns";
import { leadingName, titleName } from "@/lib/copy/names";
export { titleName } from "@/lib/copy/names";
import { notAlreadyNamed } from "@/lib/stage1/readback-tidy";
import { andList, answerNamesOption, decisionHasReason, decisionLabel, pickedStyles, type DecisionOption, type PaperContext, type ReadbackPlain } from "@/lib/stage1/paper-context";

/** "I think my team…" → "you think your team…": the student's reason, in second person. */
export function toSecondPerson(text: string): string {
  const map: Record<string, string> = { "i'm": "you're", "i've": "you've", "i'd": "you'd", "i'll": "you'll", "i": "you", "me": "you", "my": "your", "mine": "yours", "myself": "yourself", "am": "are", "im": "you're", "ive": "you've" };
  return dropHedges(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\b(i'm|i've|i'd|i'll|im|ive|i|me|my|mine|myself)\b/gi, (w) => map[w.toLowerCase()] ?? w)
    .replace(/\byou am\b/gi, "you are")
    .replace(/\byou was\b/gi, "you were");
}

/**
 * QA 3:51 nit: "…a shared vision.\nBecause of that Microsoft started…" reads clunky in the recap.
 * A follow-on effect sentence joins the reason as ", and as a result, …" (with its comma).
 */
export function smoothCause(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(.*?[^.!?])[.!?]\s+(?:because of (?:that|this|it)|as a result|that led to|this led to|so)\b,?\s*(.+)$/i);
  if (!m) return t.replace(/\b(because of (?:that|this)|as a result)\s+(?=[A-Z])/gi, "$1, ");
  const effect = m[2]!.replace(/,?\s+and (?:that|this) matters because\b.*$/i, "").replace(/[\s.!,;:]+$/, "");
  return `${m[1]}, and as a result, ${effect}`;
}

/**
 * QA full prod walk (8979326a): the leader they named, even when the menu answer was saved as
 * "their own" ("I already said it, Sam Walton!") or the name only lives in their pick.
 */
function leaderName(leader: PaperContext["leader"] | null | undefined, said: string): string | null {
  if (leader?.pick && leader.pick !== "their own" && leader.pick.length <= 40) return leader.pick;
  return namedPerson(leader?.answer ?? "") ?? namedPerson(said);
}

/** Their reason, in whole sentences (never cut mid-thought into "because… and…"): the first sentence, or two short ones. */
function wholeReason(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const parts = t.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [t];
  let out = parts[0]!.trim();
  if (out.split(/\s+/).length < 8 && parts[1]) out = `${out} ${parts[1].trim()}`;
  return out;
}

const REASON_RE = /\b(because|since|bc|cuz|'cause|so that|as it|it fits|it shows|it would|that's why|which is why)\b\s*(.*)$/i;

/**
 * QA 7:02 AM: Stage 2 paraphrases the Stage 1 decision ("Earlier you picked X with Y as your
 * example, because …") instead of quoting the raw answer.
 */
const STYLE_WORD = /^(servant|transformational|transactional|situational|democratic|autocratic|authentic|charismatic|laissez-faire|participative|adaptive|visionary|coaching|leadership)$/i;

/**
 * QA 5:51 PM: style names read as plain words mid-sentence ("servant leadership", "servant and
 * transformational leadership"), never "Servant"; a pick in their own words is left alone.
 */
export function styleText(pick: string): string {
  const words = pick.replace(/\s+/g, " ").trim().split(" ");
  const parts = words.filter((w) => !/^(and|or|&|,)$/i.test(w)).map((w) => w.replace(/,$/, ""));
  if (!parts.length || !parts.every((w) => STYLE_WORD.test(w))) return pick;
  const low = words.map((w) => (STYLE_WORD.test(w.replace(/,$/, "")) ? w.toLowerCase() : w)).join(" ");
  return /leadership$/i.test(low) ? low : `${low} leadership`;
}

export function stage2Earlier(
  decision: PaperContext["decision"] | null | undefined,
  leader?: PaperContext["leader"] | null,
  options: DecisionOption[] = [],
  /** QA 5:51 PM: the leader they gave elsewhere (Stage 1 idea, fit pair) when the decision only says "he". */
  knownLeader: string | null = null,
): string | null {
  if (!decision) return null;
  const said = decision.answer.replace(/\s+/g, " ").trim();
  if (!decisionHasReason(decision.answer)) {
    // PC-29 QA follow-up: an informed pick whose early take carries no "because" (QA 95b78e8f:
    // "…his big vision of low prices kept people bought in") still opens with the styles and the
    // leader they named, just without a reason, never the bare read-back.
    const named = pickedStyles(decision, options);
    const one = decision.pick && decision.pick !== "their own" && answerNamesOption(decision.answer, decision.pick) ? decision.pick : null;
    const pick0 = named.length > 1 ? andList(named) : one;
    const who0 = leaderName(leader, said) ?? knownLeader;
    if (pick0) return `Earlier you picked ${styleText(pick0)}${who0 ? ` with ${who0} as your example` : ""}.`;
    return null;
  }
  // QA 1:11 AM #7: both picks when they named two ("servant and transformational").
  const styles = pickedStyles(decision, options);
  const pick =
    styles.length > 1
      ? andList(styles)
      : decision.pick && decision.pick !== "their own" && answerNamesOption(decision.answer, decision.pick)
        ? decision.pick
        : null;
  const who = leaderName(leader, said) ?? knownLeader;
  const m = said.match(REASON_RE);
  const tidy = (t: string) => toSecondPerson(wholeReason(smoothCause(t))).replace(/[\s.!,;:]+$/, "");
  const reason = m ? tidy(/^(because|since|bc|cuz|'cause)$/i.test(m[1]) ? m[2] : `${m[1]} ${m[2]}`) : "";
  if (pick) {
    const ex = who ? ` with ${who} as your example` : "";
    // QA 11:51: their reason is acknowledged, not just repeated.
    return reason ? `Earlier you picked ${styleText(pick)}${ex}, because ${reason}. That's a solid reason to build on.` : `Earlier you picked ${styleText(pick)}${ex}.`;
  }
  // QA 9:37 AM: an answer that starts with its reason ("because teams need…") never reads
  // "Earlier you told me because…": the pick in their words, or "your reason:".
  if (m && m.index === 0 && reason) {
    const label = decisionLabel(decision);
    const ex = who ? ` with ${who} as your example` : "";
    return label ? `Earlier you picked ${styleText(label)}${ex}, because ${reason}. That's a solid reason to build on.` : `Earlier you told me your reason: ${reason}.${who ? ` Your example: ${who}.` : ""}`;
  }
  // QA 6:53 PM (qa8 b3d40615): "satya Nadella. I like transformational, because he rebuilt…" was
  // pasted in raw ("Earlier you told me satya Nadella. you like…"). A style and a leader are
  // synthesized in her own words, names capitalized.
  const style1 = chosenStyles([said])[0] ?? null;
  const lead1 = who ?? leadingName(said);
  if (style1 && lead1) {
    const why = reason ? (/^(he|she|they)\b/i.test(reason) ? `, mainly for how ${reason}` : `, mainly because ${reason}`) : "";
    return `You picked ${titleName(lead1)} as ${/^[aeiou]/i.test(style1) ? "an" : "a"} ${style1.toLowerCase()} leader${why}.`;
  }
  const headRaw = m && m.index! > 0 ? said.slice(0, m.index).replace(/[\s.!,;:]+$/, "") : said;
  const told0 = tidy(headRaw).replace(/^(yeah|yes|ok(?:ay)?|so|um+|well|honestly),?\s+/i, "");
  const told = m && m.index! > 0 && reason ? `${told0}, because ${reason}` : told0;
  // Only a common first word drops its capital ("You think…" → "you think…"); a name keeps it.
  const lower = /^(?:You|Your|You're|You've|You'd|The|A|An|It|It's|That|This|There|Maybe|Probably|Leaders?|Being|Having)\b/.test(told) ? `${told.charAt(0).toLowerCase()}${told.slice(1)}` : told;
  return `Earlier you told me ${lower.replace(/([.!?]\s+)([a-z])/g, (_x, a: string, b: string) => a + b.toUpperCase()).replace(/…$/, "")}${/…$/.test(told) ? "…" : "."}${who && !new RegExp(who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? ` Your example: ${who}.` : ""}`;
}

/** The opener's heading and body: the read-back's plain words win over a parsed topic. */
export function stage2IntroText(readback: ReadbackPlain | null | undefined, fallback: { heading: string; body: string }): { heading: string; body: string } {
  const ask = readback?.ask?.replace(/\s+/g, " ").trim();
  if (!ask) return fallback;
  // PC-29b: the list skips what the sentence above it already names (its sources, "one real leader").
  const must = notAlreadyNamed((readback?.mustInclude ?? []).filter(Boolean), ask).slice(0, 3);
  return {
    heading: "Your assignment, in plain words",
    body: must.length ? `${ask} It has to include: ${must.join("; ")}.` : ask,
  };
}

/** "just tell me some options" in Stage 2: the Stage 1 options again, as text plus chips. */
export function optionsAgain(options: DecisionOption[] | null | undefined, people?: DecisionOption[] | null): { paras: string[]; chips: string[] } | null {
  const opts = (options ?? []).filter((o) => o.label);
  if (opts.length < 2) return null;
  const list = opts.map((o) => (o.why ? `${o.label} (${o.why.replace(/[.\s]+$/, "")})` : o.label)).join("; ");
  const ppl = (people ?? []).map((p) => p.label).filter(Boolean);
  return {
    paras: [
      `Here are the options from earlier: ${list}.${ppl.length ? ` Real leaders that fit: ${ppl.join(", ")}.` : ""}`,
      "Which one could you defend for this section, and why? Tap one to start, then add your reason in your own words.",
    ],
    chips: opts.map((o) => o.label).slice(0, 4),
  };
}
