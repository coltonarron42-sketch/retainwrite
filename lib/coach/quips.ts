/**
 * Pau Pau's quips in Stage 2 (PLAN.md 9 personality, QA 3:35 B): a per-paper
 * pool, dealt in order to (section, slot) so no quip repeats verbatim across
 * sections in one paper; when the pool runs out the line simply has none.
 * At most one quip per reply: `oneQuip` drops any extra.
 */

/** Stage 2 pool. Each teases the situation, never the student; no repeated pattern. */
export const STAGE2_QUIPS = [
  "No crystal ball required.",
  "Painless, mostly.",
  "Rubrics love this stuff.",
  "Future-self approved.",
  "Deadlines fear this energy.",
  "Look at us, being organized.",
  "Gold star energy.",
  "Plot twist: this part is easy.",
  "Librarians live for this.",
  "Zero printer jams so far.",
  "Peak homework efficiency.",
  "Research, but make it quick.",
  "We love a plan.",
  "Fancy, right?",
  "Easier than group projects.",
  "Sources: the real MVPs.",
] as const;

export type QuipSlot = "pick_lead" | "logic_opener";
const SLOTS: QuipSlot[] = ["pick_lead", "logic_opener"];

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The paper's own order of the pool (stable for a reload). */
export function quipDeck(seed: string): string[] {
  const deck = [...STAGE2_QUIPS] as string[];
  let h = hash(seed || "rw");
  for (let i = deck.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const j = h % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/** The quip for one slot in one section, or null (pool used up / no seed). */
export function quipFor(seed: string | undefined, sectionIndex: number | undefined, slot: QuipSlot): string | null {
  if (!seed || sectionIndex === undefined || sectionIndex < 0) return null;
  const deck = quipDeck(seed);
  const n = sectionIndex * SLOTS.length + SLOTS.indexOf(slot);
  return n < deck.length ? deck[n]! : null;
}

/** Known flourishes from templates and the read-back (also counted as a quip). */
const KNOWN = [
  ...STAGE2_QUIPS,
  "Homework, my favorite genre.",
  "No pop quiz, I promise.",
  "This is totally doable.",
  "Scout's honor.",
  "Love a quick yes.",
];
const QUIPPY =
  /\b(lol|haha|kidding|honestly|i promise|my favorite genre|plot twist|riveting|thrilling|spoiler|no pressure|scout's honor|gold star|fun kind|crystal ball|not gonna lie)\b/i;

export function isQuip(sentence: string): boolean {
  const t = sentence.trim();
  return KNOWN.some((k) => t === k || t.endsWith(` ${k}`)) || QUIPPY.test(t);
}

/**
 * Keep at most one quip in a reply (template or model text): the first one
 * stays, later quip sentences are dropped. Never empties a reply.
 */
export function oneQuip(text: string): string {
  const parts = text.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g);
  if (!parts) return text;
  let seen = false;
  const kept = parts.filter((p) => {
    if (!isQuip(p)) return true;
    if (seen) return false;
    seen = true;
    return true;
  });
  const out = kept.join("").replace(/\s+/g, " ").trim();
  return out || text;
}

/** One quip across all the paragraphs of a turn. */
export function oneQuipParas(paras: string[]): string[] {
  let seen = false;
  return paras.map((p) => {
    const parts = p.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g) ?? [p];
    const kept = parts.filter((s) => {
      if (!isQuip(s)) return true;
      if (seen) return false;
      seen = true;
      return true;
    });
    return kept.join("").replace(/\s+/g, " ").trim() || p;
  });
}
