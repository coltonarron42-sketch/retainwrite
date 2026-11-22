/**
 * Split text into sentences without breaking on abbreviations or initials:
 * "Should U.S. high schools start later?" stays one sentence, as do
 * "Dr. Ruiz", "e.g. sleep", "vs. sports", "8 a.m. starts" and "J. Smith".
 */
const ABBREV =
  /(?:\b(?:[A-Z]\.){1,3}|\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|vs|etc|e\.g|i\.e|a\.m|p\.m|approx|No|Vol|pp|ed|eds|Fig|Ch|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.)$/i;

export function splitSentences(text: string | null | undefined): string[] {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out: string[] = [];
  let start = 0;
  const re = /[.!?]+["”’)]*(?=\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const end = m.index + m[0].length;
    const chunk = t.slice(start, end);
    if (m[0].startsWith(".") && m[0].length === 1 && ABBREV.test(chunk)) {
      // Next word lower-case or a continuing capitalized phrase: keep going.
      const next = t.slice(end).trimStart();
      if (!next || /^[a-z0-9]/.test(next) || /\b(?:[A-Z]\.){2,3}$/.test(chunk) || /\b(?:Mr|Mrs|Ms|Dr|Prof|St)\.$/.test(chunk)) continue;
    }
    out.push(chunk.trim());
    start = end;
  }
  if (start < t.length) out.push(t.slice(start).trim());
  return out.filter(Boolean);
}

export function firstSentenceOf(text: string | null | undefined): string {
  return splitSentences(text)[0] ?? "";
}
