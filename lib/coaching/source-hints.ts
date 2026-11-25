/**
 * P3 (pc28-plan): the student's stored source materials (readings they gave us, pages Pau found),
 * each placed at the ONE section where it fits best, so Stages 2–3 can say when and where to use it:
 * at that section's first prompt, "here's the source if you want to refresh before writing".
 * Pure and deterministic: built from paper_context.summaries (their readings, found pages, and her
 * labelled summaries of the assigned readings) (already stored), no new storage.
 * // SOP: coaching only, never generate submission text (the points are the source's, labelled).
 */
import type { MaterialSummary } from "@/lib/stage1/paper-context";

export type HintSection = { key: string; title: string; needs?: string; concept?: string | null; ideas?: string[] };
export type SourceHint = {
  title: string;
  url: string | null;
  /** Where it came from, in plain words. */
  from: "your reading" | "the source I found online" | "what I know of this assigned reading (check it against your copy)";
  /** Up to two of its key points that fit this section best. */
  points: string[];
};

const STOP = new Set(
  "about above after again against also because been before being between both could does doing during each from have having here into itself just more most other over same should some such than that their them then there these they this those through under until very what when where which while with would your yours section paper essay write writing explain explains show shows using used make makes made like".split(" "),
);
const words = (t: string) =>
  new Set(
    String(t ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/(?:ing|ed|es|s)$/, ""))
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );
const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};
const FRAME = /\b(intro|introduction|conclusion|thesis|hook|closing|reference|works cited|bibliography)\b/i;

const GENERIC = new Set(["chapter", "book", "overall", "article", "reading", "textbook", "edition", "page", "pages"]);
const workWords = (title: string) => new Set([...words(title.replace(/\(the book overall\)/i, ""))].filter((w) => !GENERIC.has(w) && !/^\d+$/.test(w)));
/** Two summaries of the same work ("Northouse, Chapter 4" and "Northouse's Leadership… (the book overall)"). */
export function sameWork(a: string, b: string): boolean {
  const x = workWords(a);
  const y = workWords(b);
  if (!x.size || !y.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  // One title's words all appear in the other's (a topic word alone, like "leadership", never merges two works).
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  return overlap(small, big) === small.size;
}
const RANK: Partial<Record<MaterialSummary["kind"], number>> = { reading: 3, found: 2, knowledge: 1 };

/**
 * The paper's sources: a reading they gave us, a page Pau found (with its link), or Pau's labelled
 * general summary of an assigned reading (her knowledge of that work; no link, check it against
 * their copy). One per work: their own copy wins, then a found page, then her summary.
 */
export function storedSources(summaries: MaterialSummary[] | null | undefined): MaterialSummary[] {
  const out: MaterialSummary[] = [];
  for (const s of summaries ?? []) {
    const r = RANK[s.kind];
    if (!r || !s.points.length || !s.title.trim()) continue;
    const at = out.findIndex((x) => sameWork(x.title, s.title));
    if (at >= 0) {
      if ((RANK[out[at]!.kind] ?? 0) > r) continue;
      out[at] = s;
    } else out.push(s);
  }
  return out;
}

/** Each source's home: the section it fits best (by shared words); a source that fits none goes to the first body section. */
export function placeSources(sections: HintSection[], summaries: MaterialSummary[] | null | undefined): Record<string, MaterialSummary[]> {
  const out: Record<string, MaterialSummary[]> = {};
  if (!sections.length) return out;
  const secWords = sections.map((s) => words([s.title, s.needs ?? "", s.concept ?? "", ...(s.ideas ?? [])].join(" ")));
  const body = sections.findIndex((s) => !FRAME.test(s.title));
  for (const src of storedSources(summaries)) {
    const sw = words([src.title, ...src.points].join(" "));
    let best = -1;
    let score = 1;
    secWords.forEach((w, i) => {
      const n = overlap(sw, w) + (FRAME.test(sections[i]!.title) ? -1 : 0);
      if (n > score) {
        score = n;
        best = i;
      }
    });
    const i = best >= 0 ? best : body >= 0 ? body : 0;
    (out[sections[i]!.key] ??= []).push(src);
  }
  return out;
}

/** The hints for one section (at most two sources), each with the two points that fit it best. */
export function sourceHintsFor(section: HintSection, sections: HintSection[], summaries: MaterialSummary[] | null | undefined): SourceHint[] {
  const here = placeSources(sections, summaries)[section.key] ?? [];
  const w = words([section.title, section.needs ?? "", section.concept ?? "", ...(section.ideas ?? [])].join(" "));
  return here.slice(0, 2).map((s) => ({
    title: s.title.trim() || "Your reading",
    url: s.sources.find((x) => /^https?:\/\//.test(x.url))?.url ?? null,
    from: s.kind === "reading" ? "your reading" : s.kind === "found" ? "the source I found online" : "what I know of this assigned reading (check it against your copy)",
    points: s.points
      .map((p, i) => ({ p, i, n: overlap(words(p), w) }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .slice(0, 2)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.p),
  }));
}

/** The lead line: when (before writing this part) and where (this section). */
export function sourceHintLead(stage: 2 | 3, sectionTitle: string): string {
  const part = sectionTitle.trim().toLowerCase() || "this section";
  return stage === 2
    ? `Here's the source if you want to refresh before writing your ${part}. This is the section to reference it in.`
    : `Here's the source to cite in your ${part}. Put it on the outline line where you use one of these points.`;
}
