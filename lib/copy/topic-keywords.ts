/** Shared whole-word topic keywords (#78), used in Stage 1 search and Stage 2 cards. */

const QUERY_STOP = new Set(
  "a an the and or of in on at to for with by from as is are was were be been being which what who whom whose how why when where whether that this these those it its do does did can could should would will most more best effective really very one real your you their them they he she his her our we us i my using use used through into about than then so if not no essay paper argue arguing argues write explain discuss".split(" "),
);

/** Trim to `max` characters at a word boundary (never mid-word, never an ellipsis). */
export function trimAtWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : t.slice(0, max)).trim();
}

/** The topic's core terms ("leadership style leading team change"), never the question's filler words. */
export function topicKeywords(topic: string | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of String(topic ?? "").replace(/[“”"'’?!.,;:()]/g, " ").split(/\s+/)) {
    const w = raw.trim();
    const lw = w.toLowerCase();
    if (!w || lw.length < 3 || QUERY_STOP.has(lw) || /^\d/.test(lw) || out.some((x) => x.toLowerCase() === lw)) continue;
    out.push(/^[A-Z][a-z]/.test(w) && out.length > 0 ? w : lw);
  }
  return out;
}

/**
 * A short keyword topic for cards and paraphrases. Never a mid-phrase cut of the raw prompt.
 */
export function cardTopicPhrase(topic: string | null | undefined): string {
  const raw = String(topic ?? "").replace(/\s+/g, " ").trim();
  const clause = raw.match(/\b((?:which|what|how|why|whether)\s+[^.:?!\n]{10,140})/i)?.[1];
  const keys = topicKeywords(clause || raw);
  if (keys.length >= 2) return keys.slice(0, 6).join(" ");
  if (keys.length === 1) return keys[0]!;
  const fallback = raw.replace(/[.…]+$/, "");
  return fallback && fallback.length <= 60 && !/…/.test(fallback) ? fallback : "your topic";
}
