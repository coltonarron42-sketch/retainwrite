/**
 * P3 (pc28-plan): the student's stored source materials (readings they gave us, pages Pau found),
 * each placed at the ONE section where it fits best, so Stages 2–3 can say when and where to use it:
 * at that section's first prompt, "here's the source if you want to refresh before writing".
 * Pure and deterministic: built from paper_context.summaries (already stored), no new storage.
 * // SOP: coaching only, never generate submission text (the points are the source's, labelled).
 */
import type { MaterialSummary } from "@/lib/stage1/paper-context";

export type HintSection = { key: string; title: string; needs?: string; concept?: string | null; ideas?: string[] };
export type SourceHint = {
  title: string;
  url: string | null;
  /** Where it came from, in plain words. */
  from: "your reading" | "the source I found online";
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

/** Their real sources only: a reading they gave us, or a page Pau found (with its link). Never her own knowledge. */
export function storedSources(summaries: MaterialSummary[] | null | undefined): MaterialSummary[] {
  const out: MaterialSummary[] = [];
  for (const s of summaries ?? []) {
    if ((s.kind !== "reading" && s.kind !== "found") || !s.points.length) continue;
    const k = s.title.trim().toLowerCase();
    const at = out.findIndex((x) => x.title.trim().toLowerCase() === k);
    // One per work: their own copy wins over a found page; the newest of the same kind wins.
    if (at >= 0) {
      if (out[at]!.kind === "reading" && s.kind === "found") continue;
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
    from: s.kind === "reading" ? "your reading" : "the source I found online",
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
