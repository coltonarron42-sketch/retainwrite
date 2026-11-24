// SOP: coaching only, never generate submission text.
import { keptIdeas } from "@/lib/coaching/thin";
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

const BACKING = /\b(because|since|for example|for instance|e\.g\.|such as|like when|shows?|showed|proves?|data|stud(?:y|ies)|percent|%|\d{2,}|when\b)/i;

/** Pau coaches the gap she sees in this section's outline (never writes the line for them). */
export function outlineGap(title: string, points: string[]): string | null {
  const t = title.toLowerCase();
  if (!points.length) return `Your ${t} has no points yet. What's the one thing it has to say?`;
  if (points.length > 5) return `That's ${points.length} points for one section. Which two or three matter most for your thesis?`;
  const joined = points.join(" ");
  if (/conclusion/.test(t)) {
    return /\b(so|therefore|overall|in the end|this means|which is why)\b/i.test(joined) ? null : "A conclusion ties back to your thesis. Which line says what it all adds up to?";
  }
  if (/intro/.test(t)) {
    return /\b(i (?:argue|think|believe|will show)|this paper|my (?:thesis|argument)|should|because)\b/i.test(joined) ? null : "Where does your intro say your main claim? Add a line that states it in your words.";
  }
  if (!BACKING.test(joined)) return "You've got the point. What reason or example backs it up? Add it as its own line.";
  return null;
}
