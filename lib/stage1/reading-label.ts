/**
 * The assigned-reading label: one choke point for every checklist render.
 * QA (after #81/#82/#83): "The assigned <type>: …", deterministic whatever the parse's wording.
 * // SOP: coaching only, never generate submission text
 */

/**
 * QA prod smoke (51dddefe): a checklist item reads as the sheet says it ("The assigned HBR article
 * 'What Makes a Leader?' by Daniel Goleman"), never with its leading "The" / "the assigned" dropped.
 */
export function asOnSheet(item: string, sheet: string): string {
  const it = item.replace(/\s+/g, " ").trim();
  const sh = String(sheet ?? "").replace(/\s+/g, " ");
  if (!it || !sh || /^(?:the|a|an|our|your)\b/i.test(it)) return it;
  const head = it.split(" ").slice(0, 3).join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = sh.match(new RegExp(`\\b((?:the|our)\\s+(?:(?:assigned|required|attached|provided)\\s+)?)${head}`, "i"));
  if (!m) return it;
  const lead = m[1]!.trim().replace(/^our\b/i, "the");
  const rest = /^(?:assigned|required|attached|provided)\s/i.test(it) ? it : `${lead.split(" ").slice(1).join(" ")} ${it}`.trim();
  return `The ${rest}`.replace(/\s+/g, " ");
}

/* ---- QA (after #81, paper c09238f7): the checklist's reading label is built, not copied ---- */

const READING_TYPE = String.raw`(?:(?:[A-Z]{2,6}\s+)?(?:article|chapter|book|textbook|essay|handout|reading|case study|report|excerpt|piece|paper|book chapter|short story|poem|video|podcast))`;
const NAME = String.raw`(?:[A-Z][\w.'’-]*\s+){0,2}[A-Z][\w'’-]+`;

export type ReadingFields = { type: string | null; title: string | null; author: string | null; chapter: string | null; source?: string | null; asWritten?: string | null; pages?: string | null };

const NAME_RUN = String.raw`[A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*){0,2}`;
const pagesOf = (raw: string) => raw.replace(/\s+/g, "").replace(/^(pp?\.)/i, (m) => `${m.toLowerCase()} `).replace(/-/g, "–");
/** The work, author first: "Leadership: Theory and Practice by Peter Northouse" → "Peter Northouse, Leadership: Theory and Practice". */
function workOf(raw: string): string {
  let w = raw.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim().replace(/^[,;:–—-]\s*/, "").replace(/\s*[,;:–—-]$/, "").trim();
  w = w.replace(/^(?:of|in|from)\s+/i, "");
  const paren = new RegExp(String.raw`^(.+?)\s*\((${NAME_RUN})\)$`).exec(w);
  if (paren) w = `${paren[2]}, ${paren[1]}`;
  const by = new RegExp(String.raw`^(.+?),?\s+by\s+(${NAME_RUN})$`).exec(w);
  if (by) w = `${by[2]}, ${by[1]}`;
  const tail = new RegExp(String.raw`^(.+?),\s+(${NAME_RUN})$`).exec(w);
  if (!by && !paren && tail && tail[1]!.split(" ").length >= 3 && /:/.test(tail[1]!) && !/:/.test(tail[2]!)) w = `${tail[2]}, ${tail[1]}`;
  return w.replace(/\s+/g, " ").trim();
}
const authorOf = (work: string) => new RegExp(String.raw`^(${NAME_RUN}),\s`).exec(work)?.[1] ?? null;

const CH = String.raw`(?:[Cc]hapter|CHAPTER|[Cc]hap\.?|[Cc]h\.?)`;

/**
 * QA #84 (e1dd9fff, b3d40615): the parse copies the sheet's instruction ("Readings: …", "Use
 * Northouse, …", "Read and cite Goleman, …"). The label is built from the work alone.
 */
export function stripLead(item: string): string {
  let t = item.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t
      .replace(/^(?:(?:required|assigned|course|key)\s+)?(?:readings?|texts?|sources?|materials?|works?)(?:\s+to\s+(?:use|read|cite))?\s*[:–—-]\s*/i, "")
      .replace(/^(?:required|must use|must cite|must include)\s*:\s*/i, "")
      .replace(/^(?:you\s+(?:must|should|will)\s+|please\s+|be sure to\s+|make sure to\s+)?(?:use|read|cite|include|reference|consult|review|incorporate|draw\s+(?:on|from)|refer\s+to|engage\s+with|apply|discuss)(?:\s+(?:and|&)\s+(?:use|read|cite|reference|discuss|apply))?\s+(?=\S)/i, "");
    if (t === before) break;
  }
  return t;
}

/** Article titles HBR and leadership courses assign most often. */
const KNOWN_ARTICLES = /^(?:what makes a leader\??|leadership that gets results|what leaders really do|level 5 leadership|the work of leadership|discovering your authentic leadership|primal leadership|why should anyone be led by you\??|the focused leader|managing oneself)$/i;
/** An article, not a book: a question title, a journal or magazine (HBR), or a known article. */
function isArticle(title: string, source: string | null, item: string): boolean {
  const t = title.replace(/[‘’“”"']/g, "").trim();
  if (KNOWN_ARTICLES.test(t)) return true;
  if (/\?$/.test(t)) return true;
  if (source && /^(?:HBR|SMR|MIT|NYT|WSJ|APA|JAMA|NEJM)$/.test(source)) return true;
  return /\b(?:HBR|Harvard Business Review|journal|review|magazine|quarterly|article)\b/i.test(item);
}

/** Type, title and author out of one assigned-reading item, however the parse worded it. */
export function readingFields(item: string): ReadingFields | null {
  let t = stripLead(item.replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, ""));
  t = t.replace(/^(?:the|a|an|our|your)\s+(?:(?:assigned|required|attached|provided)\s+)?/i, "").replace(/^(?:assigned|required|attached|provided)\s+/i, "");
  // "The assigned chapter: Chapter 4 of …" / "The assigned article: ‘…’" (already pinned): read past the label.
  const pinned = /^(chapter|article|reading|handout|book|essay|textbook|report|case study)\s*:\s*/i.exec(t);
  if (pinned) t = t.slice(pinned[0].length);
  const tailSrc = /\s+\(([A-Z]{2,6})\)$/.exec(t);
  if (tailSrc) t = t.slice(0, tailSrc.index);
  // A chapter keeps the sheet's own wording: "Chapter 4 of Northouse, Leadership: Theory and Practice".
  const chap = new RegExp(String.raw`^${CH}\s*(\d{1,2})\b(.*)$`).exec(t);
  if (chap) {
    const rest = chap[2]!.replace(/^\s*\(([^)]*)\)/, " ($1)").trim();
    const author = /^(?:of|in|from)\s+(?:the\s+|our\s+)?(?:textbook\s+)?\(?([A-Z][\w-]+)(?:,|'s|’s|'|’)/.exec(rest)?.[1] ?? null;
    return { type: "chapter", chapter: chap[1]!, author, title: null, asWritten: `Chapter ${chap[1]}${rest ? ` ${rest}` : ""}`.replace(/\s+/g, " ").trim() };
  }
  // QA prod smoke (after #83, f8df7ccc): "Northouse, Leadership: Theory and Practice (Chapter 4)",
  // "Leadership: Theory and Practice by Peter Northouse, Ch. 4", "…, pp. 45-70": the chapter or the
  // pages can sit anywhere in the item; the work is shown author first.
  const pagesAt = /^(pp?\.\s*\d+\s*[-–]\s*\d+)\s+(?:of|in|from)\s+(.+)$/i.exec(t);
  if (pagesAt) {
    const work = workOf(pagesAt[2]!);
    return { type: "reading", chapter: null, pages: pagesOf(pagesAt[1]!), author: authorOf(work), title: null, asWritten: work };
  }
  if (!/[“"‘']/.test(t)) {
    const chIn = new RegExp(String.raw`(?:\s*[,;:–—-]\s*|\s+|\s*\(\s*)${CH}\s*(\d{1,2})\s*\)?`).exec(t);
    const ppIn = /(?:\s*[,;:–—-]\s*|\s+|\s*\(\s*)(pp?\.\s*\d+\s*[-–]\s*\d+)\s*\)?/i.exec(t);
    const marks = [chIn, ppIn].filter((m): m is RegExpExecArray => Boolean(m) && m!.index > 0).sort((a, b) => b.index - a.index);
    if (marks.length) {
      let w = t;
      for (const m of marks) w = `${w.slice(0, m.index)} ${w.slice(m.index + m[0].length)}`;
      const work = workOf(w);
      // A bare author is a work too ("Northouse ch. 4, pp. 45-70" → "… of Northouse").
      if (/[A-Z]/.test(work) && (work.split(" ").length >= 2 || /^[A-Z][\w'’-]+$/.test(work))) {
        const ch = chIn && chIn.index > 0 ? chIn[1]! : null;
        return { type: ch ? "chapter" : "reading", chapter: ch, pages: ppIn && ppIn.index > 0 ? pagesOf(ppIn[1]!) : null, author: authorOf(work), title: null, asWritten: work };
      }
    }
    // A bare "Northouse, Leadership: Theory and Practice": an author, then a capitalized title.
    const bare = new RegExp(String.raw`^(${NAME_RUN}),\s+([A-Z][^,]{3,})$`).exec(t);
    if (bare && (bare[2]!.match(/\b[A-Z][a-z]+/g) ?? []).length >= 2 && !/\b(?:APA|MLA|format|words?|pages?|font|due)\b/i.test(t)) {
      // QA #84 (e1dd9fff): "Goleman, What Makes a Leader? (HBR)" is an article, not a generic reading.
      if (isArticle(bare[2]!, tailSrc?.[1] ?? null, item)) return { type: "article", chapter: null, pages: null, author: bare[1]!, title: bare[2]!.trim(), source: tailSrc?.[1] ?? null };
      return { type: "reading", chapter: null, pages: null, author: bare[1]!, title: null, asWritten: t, source: tailSrc?.[1] ?? null };
    }
  }
  // Title: the quoted part (straight or curly; a title's own apostrophe or "?" stays in it).
  const q = /(?<=^|[\s(])[“"‘']([^“”"]{3,120}?)[”"’'](?=\s|$|[,.;:)])/.exec(t);
  const title = q ? q[1]!.trim() : null;
  let rest = q ? `${t.slice(0, q.index)} ${t.slice(q.index + q[0].length)}`.replace(/\s+/g, " ").trim() : t;
  let author: string | null = null;
  const by = new RegExp(String.raw`\bby\s+(${NAME})`).exec(rest);
  if (by) {
    author = by[1]!.trim();
    rest = rest.replace(by[0], " ").replace(/\s+/g, " ").trim();
  }
  const poss = new RegExp(String.raw`^(${NAME})(?:'s|’s|s'|s’)\s+(?=${READING_TYPE}\b)`, "i").exec(rest);
  if (poss && !author) {
    author = poss[1]!.trim();
    rest = rest.slice(poss[0].length).trim();
  }
  // QA #84: an unquoted article title with its author ("What Makes a Leader? by Daniel Goleman").
  if (!title && author && !pinned && !new RegExp(String.raw`^${READING_TYPE}\b`, "i").test(rest) && (rest.match(/\b[A-Z][a-z]+/g) ?? []).length >= 2 && isArticle(rest, tailSrc?.[1] ?? null, item))
    return { type: "article", title: rest.replace(/[,;:\s]+$/, ""), author, chapter: null, source: tailSrc?.[1] ?? null };
  const typed = new RegExp(String.raw`^(${READING_TYPE})\b`, "i").exec(rest)?.[1] ?? (pinned && !/^chapter$/i.test(pinned[1]!) ? pinned[1]! : null);
  if (!typed && !title) return null;
  if (!typed && !author) return null;
  // "HBR article" → the type "article", the source "HBR" (shown after the author).
  const src = (typed ? /^([A-Z]{2,6})\s+/.exec(typed)?.[1] : null) ?? tailSrc?.[1] ?? null;
  const type = typed ? typed.replace(/^[A-Z]{2,6}\s+/, "").toLowerCase() : null;
  let ttl = title;
  if (!ttl && typed && !pinned) {
    const after = rest.slice(typed.length).replace(/^\s*(?:on|about|titled|called)\s+/i, "").trim();
    ttl = after && after.split(" ").length <= 12 ? after : null;
  }
  return { type, title: ttl, author, chapter: null, source: src };
}

/**
 * QA prod (after #81): "The assigned <type>: …", always. A chapter: "The assigned chapter: Chapter 4
 * of Northouse, Leadership: Theory and Practice". Anything else: "The assigned article: ‘What Makes a
 * Leader?’ by Daniel Goleman (HBR)". Gaps fall back gracefully; "The assigned" is never dropped.
 */
export function readingLabel(f: ReadingFields): string {
  // A work with its chapter or pages anywhere: "The assigned chapter: Chapter 4 of Northouse, Leadership: Theory and Practice".
  if ((f.chapter || f.pages || (f.type === "reading" && f.author)) && f.asWritten && !/^chapter\s/i.test(f.asWritten)) {
    const where = f.chapter ? `Chapter ${f.chapter}${f.pages ? ` (${f.pages})` : ""}` : f.pages;
    return `The assigned ${f.chapter ? "chapter" : "reading"}: ${where ? `${where} of ` : ""}${f.asWritten}`;
  }
  if (f.chapter) return `The assigned chapter: ${f.asWritten ?? `Chapter ${f.chapter}`}`;
  const type = f.type ?? "reading";
  const title = f.title ? `‘${f.title.replace(/^['‘“"]|['’”"]$/g, "")}’` : "";
  const by = f.author ? `by ${f.author}` : "";
  const src = f.source ? `(${f.source})` : "";
  const what = [title, by, src].filter(Boolean).join(" ");
  if (!what) return `The assigned ${type}`;
  return title ? `The assigned ${type}: ${what}` : `The assigned ${type} ${what}`;
}

/**
 * A checklist item: an assigned reading is labeled from its fields (deterministic, whatever the
 * parse's wording); anything else (APA, length, a leader) keeps asOnSheet's rule. Never a leading
 * lowercase "the".
 */
export function checklistLabel(item: string, sheet: string): string {
  const f = readingFields(item);
  const out = f ? readingLabel(f) : asOnSheet(item, sheet);
  return out.replace(/^the\b/, "The");
}

/** QA #84: is this requirement an assigned reading (so it is labeled, and never dropped from a list)? */
export function isReadingItem(item: string): boolean {
  return Boolean(readingFields(item));
}

/** The same pinned label, for the middle of a sentence ("A strong answer needs the assigned chapter: …"). */
export function inlineLabel(item: string): string {
  return isReadingItem(item) ? checklistLabel(item, "").replace(/^The\b/, "the") : item;
}
