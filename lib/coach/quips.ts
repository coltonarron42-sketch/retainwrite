/**
 * Pau Pau's quips in Stage 2 (PLAN.md 9 personality, QA 3:35 B): a per-paper
 * pool, dealt in order to (section, slot) so no quip repeats verbatim across
 * sections in one paper; when the pool runs out the line simply has none.
 * At most one quip per reply: `oneQuip` drops any extra.
 */

/** Stage 2 pool. Each teases the situation, never the student; no repeated pattern. */
export const STAGE2_QUIPS = [
  "I'd write it for you, but I'm legally a cartoon.",
  "I'd hold the pencil, but no thumbs.",
  "I'm weirdly into this.",
  "Deadlines scare me, and I don't even have one.",
  "I've never turned in a paper, and I'm still proud.",
  "Plot twist: this part is easy.",
  "My only skill is cheering. I'm cheering.",
  "Zero printer jams so far.",
  "Honestly, I'm a little jealous.",
  "Easier than group projects.",
  "Sources: the real MVPs.",
] as const;

/**
 * Stock filler that says nothing about the moment (QA 8:31 AM): never dealt, and
 * stripped if a model reply or template ever produces one.
 */
export const STOCK_FILLER = /\s*\b(?:Rubrics love this stuff|Teachers notice this stuff|Look at us,? being organized|Big plan energy|Fancy,? right\?|Research,? but make it quick)[.!?]*/gi;
export function dropStockFiller(text: string): string {
  return text.replace(STOCK_FILLER, "").replace(/\s{2,}/g, " ").trim();
}

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
/** Every paper hears this one once: section 1, the first quip slot (QA 5:44 PM). */
export const SIGNATURE_QUIP = "I'd write it for you, but I'm legally a cartoon.";

/**
 * The "cartoon" joke family (QA 6:53 PM #3): one pool, one use per paper. Its
 * only line is the signature, dealt once (section 1); no other pool, template,
 * welcome line or model reply calls Pau Pau a cartoon.
 */
export const CARTOON_FAMILY = [SIGNATURE_QUIP] as const;
const CARTOON = /\bcartoon\b/i;

/** Is this sentence a cartoon joke? */
export function isCartoonJoke(sentence: string): boolean {
  return CARTOON.test(sentence);
}

export function quipDeck(seed: string): string[] {
  const deck = (STAGE2_QUIPS as readonly string[]).filter((q) => q !== SIGNATURE_QUIP);
  let h = hash(seed || "rw");
  for (let i = deck.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const j = h % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return [SIGNATURE_QUIP, ...deck];
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
  "Let's get into it.",
  "Painless, mostly.",
  "No crystal ball required.",
  "No thumbs, so no pencil.",
  "Scout's honor.",
  "Love a quick yes.",
];
const QUIPPY =
  /\b(lol|haha|kidding|honestly|i promise|my favorite genre|plot twist|riveting|thrilling|spoiler|no pressure|scout's honor|gold star|fun kind|crystal ball|not gonna lie|cartoon|no thumbs)\b/i;

export function isQuip(sentence: string): boolean {
  const t = sentence.trim();
  return KNOWN.some((k) => t === k || t.endsWith(` ${k}`)) || QUIPPY.test(t);
}

/**
 * Keep at most one quip in a reply (template or model text): the first one
 * stays, later quip sentences are dropped. Never empties a reply.
 */
export function oneQuip(text0: string): string {
  const text = dropStockFiller(text0) || text0;
  const parts = text.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g);
  if (!parts) return text;
  let seen = false;
  const kept = parts.filter((p) => {
    // The cartoon joke is the app's, once per paper; model text never adds one.
    if (isCartoonJoke(p)) return false;
    if (!isQuip(p)) return true;
    if (seen) return false;
    seen = true;
    return true;
  });
  const out = kept.join("").replace(/\s+/g, " ").trim();
  return out || text;
}

/** One quip across all the paragraphs of a turn. */
export function oneQuipParas(paras0: string[]): string[] {
  let seen = false;
  const paras = paras0.map((p) => dropStockFiller(p)).filter(Boolean);
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
