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

const ASK_VERB =
  /\b(?:argu(?:e|es|ing)|explain(?:s|ing)?|analy[sz](?:e|es|ing)|discuss(?:es|ing)?|evaluat(?:e|es|ing)|decid(?:e|es|ing)|assess(?:es|ing)?|determin(?:e|es|ing)|compar(?:e|es|ing)|consider(?:s|ing)?|examin(?:e|es|ing)|address(?:es|ing)?|answer(?:s|ing)?|(?:words?|essay|paper|response)\s+on)\s+(?=(?:which|whether|how|why|what|if|to what extent|the extent)\b)/i;
const SOURCE_LEAD = /^(?:using|use|drawing on|draw on|based on|according to|with reference to|referring to|refer to|cite|citing|after reading|read)\b/i;
const FORMAT_LINE = /\b(?:apa|mla|chicago|double[- ]spaced|single[- ]spaced|font|margins?|due|submit|turn in|references? page|works cited|\d[\d,]*\s*(?:-|–|to)?\s*[\d,]*\s*(?:words?|pages?))\b/i;
const TRAILING_HOW = /,\s*(?:using|drawing on|with|citing|based on|in about|in no more than|in \d)\b.*$/i;

/** Quoted titles ('What Makes a Leader?') never end a sentence: mask them while splitting. */
function maskQuotes(text: string): { masked: string; spans: string[] } {
  const spans: string[] = [];
  const keep = (m: string) => {
    spans.push(m);
    return `\u0000${spans.length - 1}\u0000`;
  };
  const masked = text
    .replace(/“[^”]{1,160}”/g, keep)
    .replace(/‘[^’]{1,160}’/g, keep)
    .replace(/"[^"]{1,160}"/g, keep)
    .replace(/(^|[\s(])'[^']{2,160}'(?=[\s,.;:)!?]|$)/g, (m, lead: string) => lead + keep(m.slice(lead.length)));
  return { masked, spans };
}
const unmask = (s: string, spans: string[]) => s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => spans[Number(i)] ?? "");

/** Quote marks that open must close; otherwise drop them (never a half-quoted fragment). */
export function balanceQuotes(text: string): string {
  let t = text;
  const open = (t.match(/“/g) ?? []).length, close = (t.match(/”/g) ?? []).length;
  if (open !== close) t = t.replace(/[“”]/g, "");
  if ((t.match(/"/g) ?? []).length % 2) t = t.replace(/"/g, "");
  const sOpen = (t.match(/(^|[\s(])'/g) ?? []).length, sClose = (t.match(/'(?=[\s,.;:)!?]|$)/g) ?? []).length;
  if (sOpen !== sClose) t = t.replace(/(^|[\s(])'/g, "$1").replace(/(\w)'(?=[\s,.;:)!?]|$)(?!s\b)/g, "$1");
  return t.trim();
}

/**
 * QA 1:11 AM (PC-28 #2): the assignment's real question, never its sources or format line.
 * "Using Chapter 4 … and the HBR article 'What Makes a Leader?', write 1,200 words arguing
 * which leadership style is most effective for leading a team through change, using one real
 * leader" → "which leadership style is most effective for leading a team through change".
 */
export function questionOf(text: string | null | undefined): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const { masked, spans } = maskQuotes(t);
  const sentences = splitSentences(masked);
  for (const s of sentences) {
    const m = s.match(ASK_VERB);
    if (m) {
      const clause = s.slice(m.index! + m[0].length).replace(TRAILING_HOW, "").replace(/[\s.;:!,]+$/, "");
      const out = balanceQuotes(unmask(clause, spans));
      if (out.split(" ").length >= 3) return out;
    }
  }
  for (const s of sentences) {
    if (/\?\s*$/.test(s) && !FORMAT_LINE.test(s) && !SOURCE_LEAD.test(s)) return balanceQuotes(unmask(s, spans));
  }
  for (const s of sentences) {
    if (SOURCE_LEAD.test(s) || FORMAT_LINE.test(s) || s.split(" ").length < 4) continue;
    return balanceQuotes(unmask(s, spans));
  }
  // Only a sources or format line (QA 3:26 AM: "Using Chapter 4 … the HBR article 'What Makes a
  // Leader?" stored as the prompt): no question here, never quote it as one.
  return "";
}

/**
 * QA 3:26 AM #1: the question every prompt check quotes and tests against: the stored prompt's
 * real question, else the assignment sheet's, else the topic. Never a sources or format line.
 */
export function assignmentQuestion(input: { prompt?: string | null; raw?: string | null; topic?: string | null }): string {
  const fromPrompt = questionOf(input.prompt);
  if (fromPrompt) return fromPrompt;
  const fromRaw = questionOf(input.raw);
  if (fromRaw) return fromRaw;
  const topic = (input.topic ?? "").replace(/\s+/g, " ").trim();
  return topic && !SOURCE_LEAD.test(topic) && !FORMAT_LINE.test(topic) ? balanceQuotes(topic) : "";
}

/** A stored prompt that is really a sources/format line, or ends inside an open quote. */
export function isSourcesLine(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return !questionOf(t) || /(^|[\s(])['‘“"][^'’”"]{0,80}\?\s*$/.test(t);
}


/**
 * QA 1:11 AM #5: one question per turn. While the return's opener ("keep going, or check the
 * progress?") is up, the turn below drops its own closing question; it comes back once they answer.
 */
export function withoutClosingQuestion(paras: string[]): string[] {
  const out = [...paras];
  for (let i = out.length - 1; i >= 0; i--) {
    const p = out[i]!.trim();
    if (!p) continue;
    if (!/\?["”’)]?$/.test(p)) return paras;
    const parts = p.split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/);
    while (parts.length && /\?["”’)]?$/.test(parts.at(-1)!.trim())) parts.pop();
    const rest = parts.join(" ").trim();
    if (rest) out[i] = rest;
    else out.splice(i, 1);
    return out.length ? out : paras;
  }
  return paras;
}

/** How many questions a line asks ("A? Or B?" counts as two). */
export function questionCount(text: string): number {
  return (text.match(/\?(?=["”’)]?(?:\s|$))/g) ?? []).length;
}
