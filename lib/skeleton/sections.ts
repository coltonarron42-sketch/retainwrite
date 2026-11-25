// SOP: coaching only, never generate submission text.
// PC-30 The Skeleton (full screen): the paper's sections in order, which ones are done, and
// where each one is worked on now. Pure functions over the existing data (the ghost shape view
// and the student's saved section notes); nothing here stores or invents content.
import type { SkeletonView } from "@/lib/skeleton/shape";

export type SkeletonGroup = "intro" | "body" | "conclusion";

/** The student's own saved words per section group (from the loop session). */
export type SkeletonWords = Partial<Record<SkeletonGroup, { locked: boolean; notes: string[]; outline?: string[] }>>;

/** The loop session's three sections: intro, body, conclusion. */
export type SessionSectionLike = { key: string; kind: string; status: string; ideas: string[] };

/** One row in The Skeleton. */
export type PaperSection = {
  /** Stable id (the shape block key, or "title"). */
  id: string;
  /** Where it sits in the paper ("Body Paragraph 2"); null when the title already says it. */
  kicker: string | null;
  /** The shaped title from #64's skeleton (ghost #2's short title, else the shape's focus). */
  title: string;
  group: SkeletonGroup | "title";
  /** The loop session section this is worked on in (intro | body | conclusion), or null. */
  sectionKey: string | null;
  /** Done: the section is locked AND has the student's own words. */
  completed: boolean;
  /** The student's own saved words (only for completed sections). */
  preview: string[];
};

type Block = SkeletonView["blocks"][number];

/** Notes the student kept (the same rule as the loop: blank lines dropped). */
function kept(ideas: string[]): string[] {
  return ideas.map((i) => i.trim()).filter(Boolean);
}

/**
 * The student's words per group, from the loop session (the one source of truth).
 * Locked = confirmed in Stance, or outlined in Stage 3.
 */
export function skeletonWordsFromSession(
  sections: SessionSectionLike[],
  outlineDone: string[] = [],
  keep: (ideas: string[]) => string[] = kept,
): SkeletonWords {
  const out: SkeletonWords = {};
  for (const item of sections) {
    const g: SkeletonGroup = item.kind === "intro" ? "intro" : item.kind === "conclusion" ? "conclusion" : "body";
    const locked = item.status === "confirmed" || outlineDone.includes(item.key);
    const notes = keep(item.ideas ?? []);
    const prev = out[g];
    // More than one body section: their notes add up (never overwrite each other).
    out[g] = prev ? { locked: prev.locked || locked, notes: [...prev.notes, ...notes] } : { locked, notes };
  }
  return out;
}

/** Which of the student's own words belong to a block. */
export function wordsForBlock(block: Block, bodyBlocks: Block[], words: SkeletonWords): string[] {
  const w = words[block.group];
  if (!w) return [];
  if (block.group !== "body") return [...w.notes, ...(w.outline ?? [])];
  const i = bodyBlocks.findIndex((b) => b.key === block.key);
  if (bodyBlocks.some((b) => b.ideaRefs.length)) {
    // Ghost #2 placed the notes: a note shows once, in the first paragraph that uses it; notes it
    // didn't place spread over the paragraphs it left empty (never doubled up with a placed one).
    if (block.ideaRefs.length) {
      const taken = new Set(bodyBlocks.slice(0, Math.max(0, i)).flatMap((b) => b.ideaRefs));
      return block.ideaRefs.filter((r) => !taken.has(r)).map((r) => w.notes[r]).filter((x): x is string => Boolean(x));
    }
    const claimed = new Set(bodyBlocks.flatMap((b) => b.ideaRefs));
    const free = w.notes.filter((_, j) => !claimed.has(j));
    const open = bodyBlocks.filter((b) => !b.ideaRefs.length);
    const k = open.findIndex((b) => b.key === block.key);
    if (k < 0) return [];
    return free.filter((_, j) => Math.min(j, open.length - 1) === k);
  }
  if (i < 0) return [];
  const last = i === bodyBlocks.length - 1;
  const own = w.notes.filter((_, j) => Math.min(j, bodyBlocks.length - 1) === i);
  return last ? [...own, ...(w.outline ?? [])] : own;
}

/** Does the assignment call for a title page? (formatting rules, wording, or APA). */
export function needsTitlePage(input: { formattingRules?: string[] | null; citationStyle?: string | null; text?: string | null }): boolean {
  const rules = (input.formattingRules ?? []).join(" ");
  if (/\b(title|cover)\s*page\b/i.test(`${rules} ${input.text ?? ""}`)) return !/\bno\s+(title|cover)\s*page\b/i.test(`${rules} ${input.text ?? ""}`);
  return (input.citationStyle ?? "").toLowerCase() === "apa";
}

/** The session section a shape group is worked on in. */
function sessionKeyFor(group: SkeletonGroup, sessionKeys: string[] | null): string | null {
  if (!sessionKeys) return group;
  const exact = sessionKeys.find((k) => k === group);
  if (exact) return exact;
  return sessionKeys.find((k) => k.startsWith(group)) ?? null;
}

/**
 * The paper in order: (Title Page), Introduction, Body Paragraph 1..N, Conclusion. The count
 * comes from the shape (the real assignment), never a fixed three. A section shows its card
 * only when it's done and has the student's own words; ghost prose never appears.
 */
export function paperSections(input: {
  view: SkeletonView | null;
  words: SkeletonWords;
  titlePage?: boolean;
  /** Keys of the loop session's sections, when known (to map groups to where they're worked on). */
  sessionKeys?: string[] | null;
}): PaperSection[] {
  const { view, words } = input;
  if (!view) return [];
  const body = view.blocks.filter((b) => b.group === "body");
  const out: PaperSection[] = [];
  if (input.titlePage) out.push({ id: "title", kicker: null, title: "Title Page", group: "title", sectionKey: null, completed: false, preview: [] });
  for (const b of view.blocks) {
    const n = body.findIndex((x) => x.key === b.key);
    const { kicker, title } = shapedTitle(b, n);
    const mine = wordsForBlock(b, body, words).map((t) => t.trim()).filter(Boolean);
    const completed = Boolean(words[b.group]?.locked) && mine.length > 0;
    out.push({ id: b.key, kicker, title, group: b.group, sectionKey: sessionKeyFor(b.group, input.sessionKeys ?? null), completed, preview: completed ? mine : [] });
  }
  return out;
}

const cap = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : t);
/**
 * Round 3: the row titles come from #64's shaped skeleton. Body rows: ghost #2's short title (from
 * the student's own choices, leak-checked server side), else the shape's focus for that paragraph,
 * under a small "Body Paragraph n" kicker. Intro and conclusion keep their names, with the shape's
 * subheading as the title line ("Introduction" / "Hook, context and your thesis").
 */
export function shapedTitle(b: SkeletonView["blocks"][number], bodyIndex: number): { kicker: string | null; title: string } {
  const sub = cap((b.sub ?? "").replace(/\s+/g, " ").trim());
  if (b.group === "body") {
    const own = (b.title ?? "").replace(/\s+/g, " ").trim();
    const kicker = `Body Paragraph ${bodyIndex + 1}`;
    return { kicker, title: own || sub || kicker };
  }
  const name = b.group === "intro" ? "Introduction" : "Conclusion";
  return sub ? { kicker: name, title: sub } : { kicker: null, title: name };
}

/**
 * Where a section is worked on now. Drafting (Stage 4+) is paused, so: Stage 2 (Stance) while
 * the paper is in Stage 2, the Stage 3 outline after that (read-only once Stage 3 is done).
 * Nothing opens while the paper is in Stage 1 (Stage 2 is still ahead).
 */
export function sectionTarget(paperStage: number, section: Pick<PaperSection, "sectionKey">): { stage: 2 | 3; section: string } | null {
  if (!section.sectionKey || paperStage < 2) return null;
  return { stage: paperStage === 2 ? 2 : 3, section: section.sectionKey };
}

export function sectionHref(paperId: string, target: { stage: number; section: string }): string {
  return `/app/papers/${paperId}/stage/${target.stage}?section=${encodeURIComponent(target.section)}`;
}

/** A short, whole-sentence preview of the student's words (never cut mid-word). */
export function previewText(lines: string[], max = 420): string {
  const t = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
/** Their direction, short: their own sentences, no repeats, no fragments (their words only). */
export function shortDirection(text: string | null | undefined, max = 240): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/)) {
    const sent = raw.trim();
    const key = sent.toLowerCase().replace(/[^a-z ]/g, "");
    if (!sent || /…$/.test(sent) || sent.split(" ").length < 4 || seen.has(key)) continue;
    if ([...seen].some((k) => k.includes(key) || key.includes(k))) continue;
    seen.add(key);
    if (out.length && [...out, sent].join(" ").length > max) break;
    out.push(sent);
    if (out.length === 2) break;
  }
  const t = out.join(" ");
  return t ? (t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t) : null;
}

