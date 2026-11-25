/**
 * PC-31: grounding gate for Pau's side answers (Stage 1-2 typed and spoken answers).
 * 1. A requirement count ("needs six body paragraphs") that the assignment doesn't state is replaced with
 *    an honest line that the assignment doesn't set one.
 * 2. A claim about what a named reading says, when we don't have that reading's text, gets the R2 label
 *    ("I don't have your copy, so here's the general idea:") unless the line already carries one.
 * Tunables: GROUNDING in prose-gate.config.ts.
 * // SOP: coaching only, never generate submission text
 */
import { GROUNDING } from "@/lib/coach/prose-gate.config";

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, single: 1 };
const NUM = "(\\d{1,3}(?:[,–-]\\d{1,3})?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const REQ = new RegExp(
  `\\b(?:needs?|requires?|required|must (?:have|include|be)|should (?:have|include|be)|calls? for|asks? for|expects?|wants?|has to (?:have|include)|is supposed to have|aim for|you'll want|plan on)\\b[^.!?]{0,30}?\\b(?:(?:at least|about|around|roughly|exactly|a total of|no more than|up to)\\s+)?${NUM}\\s+(?:(?:short|main|full|strong|solid|separate|scholarly|credible|peer-reviewed|outside)\\s+)?(${GROUNDING.countNouns})\\b`,
  "i",
);

const sentencesOf = (t: string) => t.match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [t];

function numberIn(source: string, n: string): boolean {
  const s = source.toLowerCase();
  const v = NUM_WORDS[n.toLowerCase()] ?? Number(n.replace(/[,–-].*$/, ""));
  if (!Number.isFinite(v)) return false;
  const word = Object.entries(NUM_WORDS).find(([w, x]) => x === v && w.length > 1 && w !== "single")?.[0];
  return new RegExp(`\\b${v}\\b`).test(s) || (word ? new RegExp(`\\b${word}\\b`).test(s) : false);
}

export type GroundOpts = {
  /** The assignment and paper-context text: the only place requirement facts may come from. */
  source: string;
  /** Names of assigned readings (titles, author names) we do NOT have the text of. */
  unreadRefs: string[];
};

export type GroundResult = { paras: string[]; fixedCounts: string[]; labeled: number };

/** Author and title words to watch for in a line ("Northouse", "Goleman"). */
export function refTokens(titles: string[]): string[] {
  const out = new Set<string>();
  for (const t of titles) for (const w of t.match(/\b[A-Z][a-zA-Z'’-]{3,}\b/g) ?? []) if (!GROUNDING.stopTitleWords.test(w)) out.add(w);
  return [...out];
}

/** ", from general background on Northouse's survey of approaches," / "(general background on X)". */
const AWKWARD_LABEL = /,?\s*\(?(?:drawing\s+)?(?:from|based on|per)\s+(?:the\s+)?general background(?:\s+(?:on|about|from)\s+[^,.;:()]{1,60})?\)?,?/gi;

export function groundParas(paras: string[], o: GroundOpts): GroundResult {
  const fixedCounts: string[] = [];
  let labeled = 0;
  const refs = refTokens(o.unreadRefs);
  const refRe = refs.length ? new RegExp(`\\b(?:${refs.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:['’]s)?\\b`) : null;
  // One label up front covers the bullets under it (a summary that opens "General background: ...").
  // t213u #4: "Servant leadership, from general background on Northouse's survey, means…" reads awkwardly;
  // drop the inline phrase and lead with the natural label once.
  let prefixed = false;
  paras = paras.map((p) => {
    const t = p.replace(AWKWARD_LABEL, (m) => (/^,.*,$/.test(m.trim()) ? "" : " ")).replace(/\s+([,.;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
    if (t === p.trim()) return p;
    if (prefixed || paras.slice(0, 2).some((q) => q !== p && GROUNDING.label.test(q))) return t;
    prefixed = true;
    const bullet = t.match(/^\s*•\s*/)?.[0] ?? "";
    return `${bullet}${GROUNDING.prefix} ${t.slice(bullet.length)}`;
  });
  const leadLabeled = paras.slice(0, 2).some((p) => GROUNDING.label.test(p));
  const out = paras.map((p) => {
    // 1. Requirement counts the assignment doesn't state.
    let text = sentencesOf(p)
      .map((s) => {
        const m = s.match(REQ);
        if (!m || numberIn(o.source, m[1]!)) return s;
        const noun = m[2]!.toLowerCase().replace(/s$/, "") + "s";
        fixedCounts.push(m[0]);
        return `The assignment doesn't set a number of ${noun}, so that part's your call.`;
      })
      .filter((s, i, a) => a.indexOf(s) === i)
      .join(" ");
    // 2. Unlabeled claims about a reading we don't have.
    if (refRe && !leadLabeled && !/^•?\s*Sources:/i.test(text) && !GROUNDING.label.test(text) && !/\?\s*$/.test(text)) {
      // A claim: "<ref> describes ..." or an attribution ("... from Northouse chapter 4", "in Goleman's article").
      const attrRe = new RegExp(`\\b(?:from|in|per|according to|as)\\s+(?:the\\s+)?${refRe.source}`);
      const claim = sentencesOf(text).some((s) => refRe.test(s) && (GROUNDING.claimVerbs.test(s) || attrRe.test(s)) && !/\?\s*$/.test(s));
      if (claim) {
        labeled++;
        const bullet = text.match(/^\s*•\s*/)?.[0] ?? "";
        text = `${bullet}${GROUNDING.prefix} ${text.slice(bullet.length)}`;
      }
    }
    return text;
  });
  return { paras: out, fixedCounts, labeled };
}
