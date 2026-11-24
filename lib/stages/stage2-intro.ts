/**
 * Stage 2 opener and carry-over (QA 6:03 AM): the plain-words assignment from
 * the read-back as the teach line, the actual decision and reason from Stage 1
 * (never "idk"), and the Stage 1 options reused when they ask for options.
 * // SOP: coaching only, never generate submission text
 */
import { clipWords } from "@/lib/copy/clip";
import { answerNamesOption, decisionHasReason, type DecisionOption, type PaperContext, type ReadbackPlain } from "@/lib/stage1/paper-context";

/** "I think my team…" → "you think your team…": the student's reason, in second person. */
export function toSecondPerson(text: string): string {
  const map: Record<string, string> = { "i'm": "you're", "i've": "you've", "i'd": "you'd", "i'll": "you'll", "i": "you", "me": "you", "my": "your", "mine": "yours", "myself": "yourself", "am": "are", "im": "you're", "ive": "you've" };
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\b(i'm|i've|i'd|i'll|im|ive|i|me|my|mine|myself)\b/gi, (w) => map[w.toLowerCase()] ?? w)
    .replace(/\byou am\b/gi, "you are")
    .replace(/\byou was\b/gi, "you were");
}

const REASON_RE = /\b(because|since|bc|cuz|'cause|so that|as it|it fits|it shows|it would|that's why|which is why)\b\s*(.*)$/i;

/**
 * QA 7:02 AM: Stage 2 paraphrases the Stage 1 decision ("Earlier you picked X with Y as your
 * example, because …") instead of quoting the raw answer.
 */
export function stage2Earlier(decision: PaperContext["decision"] | null | undefined, leader?: PaperContext["leader"] | null): string | null {
  if (!decision || !decisionHasReason(decision.answer)) return null;
  const said = decision.answer.replace(/\s+/g, " ").trim();
  const pick = decision.pick && decision.pick !== "their own" && answerNamesOption(decision.answer, decision.pick) ? decision.pick : null;
  const who = leader?.pick && leader.pick !== "their own" ? leader.pick : null;
  const m = said.match(REASON_RE);
  const tidy = (t: string) => clipWords(toSecondPerson(t).replace(/[\s.!,;:]+$/, ""), 160);
  const reason = m ? tidy(/^(because|since|bc|cuz|'cause)$/i.test(m[1]) ? m[2] : `${m[1]} ${m[2]}`) : "";
  if (pick) {
    const ex = who ? ` with ${who} as your example` : "";
    return reason ? `Earlier you picked ${pick}${ex}, because ${reason}.` : `Earlier you picked ${pick}${ex}.`;
  }
  const told = tidy(said).replace(/^(yeah|yes|ok(?:ay)?|so|um+|well|honestly),?\s+/i, "");
  return `Earlier you told me ${told.charAt(0).toLowerCase()}${told.slice(1)}.${who && !new RegExp(who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? ` Your example: ${who}.` : ""}`;
}

/** The opener's heading and body: the read-back's plain words win over a parsed topic. */
export function stage2IntroText(readback: ReadbackPlain | null | undefined, fallback: { heading: string; body: string }): { heading: string; body: string } {
  const ask = readback?.ask?.replace(/\s+/g, " ").trim();
  if (!ask) return fallback;
  const must = (readback?.mustInclude ?? []).filter(Boolean).slice(0, 3);
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
