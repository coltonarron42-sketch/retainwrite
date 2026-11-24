// SOP: coaching only, never generate submission text.
import { keptIdeas } from "@/lib/coaching/thin";
import { contradictsThesis, quoteOnWordBoundary } from "@/lib/coaching/logicCheck";
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

/** Pau coaches the gap she sees in this section's outline (never writes the line for them). */
export function outlineGap(title: string, points: string[], thesis?: string | null): string | null {
  const t = title.toLowerCase();
  if (!points.length) return `Your ${t} has no points yet. What's the one thing it has to say?`;
  if (points.length > 5) return `That's ${points.length} points for one section. Which two or three matter most for your thesis?`;
  const joined = points.join(" ");
  // A line that turns against their own thesis is named first (QA 8:31 AM: a contradictory Conclusion).
  if (thesis && !/intro/.test(t)) {
    const against = contradictsThesis(joined, thesis);
    if (against)
      return `Your ${t} says “${quoteOnWordBoundary(dropHedges(against.noteQuote), 90)}”, but your thesis says “${quoteOnWordBoundary(dropHedges(against.thesisQuote), 90)}”. Which one does your paper argue? Make them match.`;
  }
  if (/conclusion/.test(t)) {
    return /\b(so|therefore|overall|in the end|this means|which is why)\b/i.test(joined) ? null : "A conclusion ties back to your thesis. Which line says what it all adds up to?";
  }
  if (/intro/.test(t)) {
    return /\b(i (?:argue|think|believe|will show)|this paper|my (?:thesis|argument)|should|because)\b/i.test(joined) ? null : "Where does your intro say your main claim? Add a line that states it in your words.";
  }
  if (!BACKING.test(joined) && !points.some((p) => NAMED_EXAMPLE.test(p.replace(/^\S+\s/, "")))) return "You've got the point. What reason or example backs it up? Add it as its own line.";
  return null;
}
