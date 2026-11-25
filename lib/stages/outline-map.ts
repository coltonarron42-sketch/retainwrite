// SOP: coaching only, never generate submission text.
import { keptIdeas } from "@/lib/coaching/thin";
import { contradictsThesis, wholeQuote } from "@/lib/coaching/logicCheck";
import { dropHedges } from "@/lib/copy/tidy";
import { sectionPurpose } from "@/lib/stage1/paper-context";

export type OutlineMapRow = { key: string; title: string; purpose: string; points: string[]; done: boolean; current: boolean };

/** One note → its outline points, in the student's own words (lines, else sentences). Never rewritten. */
export function outlinePoints(text: string): string[] {
  const t = (text ?? "").trim();
  if (!t) return [];
  const lines = t.split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return (t.match(/[^.!?]+[.!?]*/g) ?? [t]).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2);
}

/**
 * QA 7:11 AM (Stage 3): the mapped outline, visible: each section, its purpose, and the
 * student's points in their own words (the box's text for the open section).
 */
export function outlineMap(
  sections: { key: string; title: string; ideas: string[] }[],
  done: string[],
  current: { key: string; text: string } | null,
): OutlineMapRow[] {
  return sections.map((s) => {
    const isCurrent = current?.key === s.key;
    const text = isCurrent ? current!.text : keptIdeas(s.ideas).join("\n");
    return { key: s.key, title: s.title, purpose: sectionPurpose(s.title), points: outlinePoints(text), done: done.includes(s.key), current: isCurrent };
  });
}

const BACKING = /\b(because|since|for example|for instance|e\.g\.|such as|like when|example|case|shows?|showed|proves?|data|stud(?:y|ies)|percent|%|\d{2,}|when\b|led|changed|turned|made|built|launched|introduced|pushed|got (?:the|his|her|their)|at [A-Z]\w+)/i;
/** A named example ("Satya Nadella at Microsoft"): a real backing line already there (QA 8:31 AM). */
const NAMED_EXAMPLE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/;

/** Capitalized words that start sentences or name the styles, not people or places. */
const NOT_NAMES = new Set(
  "The This That These Those It Its He She They We You I My Our Your His Her Their So But And Or In On At When If Because Then Also Even With Without After Before During While Overall First Second Third Finally One A An Transformational Situational Servant Behavioral Authentic Leadership Leaders Leader Team Teams People Change Body Introduction Conclusion Intro Yes No Okay Ok Honestly Maybe Probably".split(" "),
);
/** Names in their notes ("Barra", "Satya Nadella", "Microsoft"): a real example is already there (QA 9:37 AM). */
export function exampleNames(text: string): string[] {
  const out: string[] = [];
  for (const m of (text ?? "").matchAll(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g)) {
    const words = m[0].split(/\s+/).filter((w) => !NOT_NAMES.has(w));
    if (words.length) out.push(words.join(" "));
  }
  return [...new Set(out)];
}
const EVENT = /\b(after|during|when|in \d{4}|recall|crisis|merger|layoffs?|turnaround|launch)\b/i;

/** Pau coaches the gap she sees in this section's outline (never writes the line for them). */
export function outlineGap(title: string, points: string[], thesis?: string | null, allNotes?: string | null, pick?: string | null): string | null {
  const t = title.toLowerCase();
  // QA 10:21: coaching grounded in THEIR notes and pick, not a generic template.
  const raw = (pick ?? "").trim();
  const style = raw ? (/^(transformational|situational|servant|authentic|transactional)$/i.test(raw) ? `${raw.toLowerCase()} leadership` : raw) : null;
  const lead = wholeQuote(points[0] ?? "");
  if (!points.length) return `Your ${t} has no points yet. What's the one thing it has to say?`;
  if (points.length > 5) return `That's ${points.length} points for one section. Which two or three matter most for your thesis?`;
  const joined = points.join(" ");
  // A line that turns against their own thesis is named first (QA 8:31 AM: a contradictory Conclusion).
  if (thesis && !/intro/.test(t)) {
    const against = contradictsThesis(joined, thesis);
    if (against)
      return `Your ${t} says “${wholeQuote(against.noteQuote)}”, but your thesis says “${wholeQuote(against.thesisQuote)}”. Which one does your paper argue? Make them match.`;
  }
  if (/conclusion/.test(t)) {
    return /\b(so|therefore|overall|in the end|this means|which is why)\b/i.test(joined) ? null : "A conclusion ties back to your thesis. Which line says what it all adds up to?";
  }
  if (/intro/.test(t)) {
    if (!/\b(i (?:argue|think|believe|will show)|this paper|my (?:thesis|argument)|should|because|works? best|most effective)\b/i.test(joined))
      return style
        ? `Your intro opens with “${lead}”, but it doesn't say your claim yet. You picked ${style}: add a line that says, in your words, why it works best.`
        : "Where does your intro say your main claim? Add a line that states it in your words.";
    // Intro coaching (QA 9:37 AM): the reader should know where you're headed.
    const names = exampleNames(allNotes ?? "").filter((n) => !joined.toLowerCase().includes(n.toLowerCase()));
    if (names.length) return `Your intro states your claim. Add a line that previews your example, ${names[0]}, so the reader knows where you're headed.`;
    if (points.length < 2) return `Your intro states your claim, “${lead}” — now add one line on why that matters, so the reader wants to keep going.`;
    // Complete intro: still coached on THEIR lines (QA 10:21), never a generic template.
    const claim = points.find((p) => /\b(i (?:argue|think|believe|will show)|should|because|works? best|most effective)\b/i.test(p)) ?? points[0]!;
    const shown = exampleNames(joined)[0];
    return shown
      ? `Your intro has your claim, “${wholeQuote(claim)}”, and previews ${shown}. Keep the claim as its own line so a reader can find it fast.`
      : `Your intro has your claim, “${wholeQuote(claim)}”. Keep it as its own line so a reader can find it fast.`;
  }
  const hasExample = BACKING.test(joined) || EVENT.test(joined) || exampleNames(joined).length > 0 || points.some((p) => NAMED_EXAMPLE.test(p));
  if (!hasExample)
    return style
      ? `Your body says “${lead}” — what moment shows ${style} in action? Add it as its own line.`
      : `Your body says “${lead}” — what reason or example backs it up? Add it as its own line.`;
  // Their example is there: does it say which part of their pick it shows?
  const names = exampleNames(joined);
  // Any of the styles they picked counts ("servant and transformational leadership").
  const styleWords = style ? (style.toLowerCase().split(/[\s:,]+/).filter((w) => w && !["and", "or", "leadership", "the", "a"].includes(w))) : [];
  if (style && names.length && styleWords.length && !styleWords.some((w) => joined.toLowerCase().includes(w)))
    return `Your body has ${names[0]}. Add a line that ties it to ${style}: which part of ${style} does it show?`;
  return null;
}
