/**
 * Stage 2 opener and carry-over (QA 6:03 AM): the plain-words assignment from
 * the read-back as the teach line, the actual decision and reason from Stage 1
 * (never "idk"), and the Stage 1 options reused when they ask for options.
 * // SOP: coaching only, never generate submission text
 */
import { clipWords } from "@/lib/copy/clip";
import { decisionHasReason, type DecisionOption, type PaperContext, type ReadbackPlain } from "@/lib/stage1/paper-context";

export function stage2Earlier(decision: PaperContext["decision"] | null | undefined, leader?: PaperContext["leader"] | null): string | null {
  if (!decision || !decisionHasReason(decision.answer)) return null;
  const said = clipWords(decision.answer.replace(/\s+/g, " ").trim(), 160);
  const head = decision.pick && decision.pick !== "their own" ? `Earlier you picked ${decision.pick}: “${said}”` : `Earlier you said: “${said}”`;
  const who = leader?.pick && leader.pick !== "their own" && !new RegExp(leader.pick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(decision.answer) ? ` Your leader: ${leader.pick}.` : "";
  return head + who;
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
