/**
 * QA (after #81): proper names from the readings keep their capitals in Body hints and skeleton
 * lines ("Tie it to Northouse's styles", never "northouse's"). Pure, shared by server and client.
 */

const STRUCTURAL = new Set(
  "body paragraph paragraphs introduction intro conclusion section part point main transition counterargument reply hook thesis closing".split(" "),
);
const NOT_A_NAME = new Set(
  "the a an and or of in on for to by with using use our your this that these those chapter chapters ch article articles reading readings handout textbook book theory practice due write arguing argue which what how why when where who whether one real leader leadership style styles team change essay paper words page pages prof professor course".split(" "),
);
const ACRONYM = /^[A-Z]{2,6}\d?$/;
const CAP = /^[A-Z][a-z][A-Za-z'’-]*$/;
const bare = (w: string) => w.replace(/^[^A-Za-z]+|[^A-Za-z'’]+$/g, "");
const base = (w: string) => bare(w).replace(/(?:'s|’s|'|’)$/i, "");

/** Author and other proper names the assignment text gives for its readings (Northouse, Daniel Goleman, HBR). */
export function readingNames(text: string | null | undefined): string[] {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const out = new Set<string>();
  const add = (w: string | undefined) => {
    const b = base(w ?? "");
    if (b.length >= 2 && (CAP.test(b) || ACRONYM.test(b)) && !NOT_A_NAME.has(b.toLowerCase())) out.add(b);
  };
  for (const m of t.matchAll(/\bby\s+((?:[A-Z][\w.'’-]*\s+){0,2}[A-Z][\w'’-]+)/g)) for (const w of m[1]!.split(/\s+/)) add(w.replace(/\.$/, ""));
  for (const m of t.matchAll(/\b([A-Z][a-z][\w-]*)(?:'s|’s|s'|s’)(?=\s)/g)) add(m[1]);
  for (const m of t.matchAll(/(?:\(|\bof\s+)([A-Z][a-z][\w-]+),\s+[A-Z]/g)) add(m[1]);
  for (const m of t.matchAll(/\b([A-Z]{2,6})\b(?=\s+(?:article|chapter|reading|handout|case|piece|report))/g)) add(m[1]);
  return [...out];
}

/** Put the readings' names back in their own case ("tie it to northouse's styles" → "…Northouse's…"). */
export function restoreNames(s: string, names: string[]): string {
  let out = s;
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${esc}\\b`, "gi"), n);
  }
  return out;
}

/**
 * A section title for the middle of a sentence ("your tie it to Northouse's styles"): common words
 * lowercased; names kept (acronyms, possessives, a capital after a lowercase word, a run of two or
 * more capitalized words that isn't "Body Paragraph").
 */
export function lowerTitle(title: string | null | undefined): string {
  const ws = String(title ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const keep = ws.map(() => false);
  ws.forEach((w, i) => {
    const b = bare(w);
    if (!b) return;
    if (ACRONYM.test(base(w))) keep[i] = true;
    else if (CAP.test(b) && /(?:'s|’s)$/.test(b)) keep[i] = true;
    else if (CAP.test(b) && i > 0 && /^[a-z]/.test(bare(ws[i - 1]!))) keep[i] = true;
  });
  // A run of capitalized words ("Sam Walton") is a name unless it's structural ("Body Paragraph").
  for (let i = 0; i < ws.length; ) {
    let j = i;
    while (j < ws.length && CAP.test(bare(ws[j]!)) && !STRUCTURAL.has(base(ws[j]!).toLowerCase())) j++;
    if (j - i >= 2) for (let k = i; k < j; k++) keep[k] = true;
    i = j > i ? j : i + 1;
  }
  return ws.map((w, i) => (keep[i] ? w : w.toLowerCase())).join(" ");
}
