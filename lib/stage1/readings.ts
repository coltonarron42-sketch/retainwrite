/**
 * Every required reading or handout an assignment names (QA 6:03 AM #2): the
 * read-back lists each one and each gets the material step. Pure: used by the
 * client read-back and the server's material lookup.
 */
import { stripLead } from "@/lib/stage1/reading-label";

type Field<T> = { value?: T | null } | undefined;
type ReqLike = {
  requiredSources?: Field<{ notes?: string | null; types?: string | null }>;
  providedReadings?: Field<{ title?: string; url?: string; notes?: string; origin?: string }[]>;
  promptQuestion?: Field<string>;
  otherInstructions?: Field<string>;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const keyWords = (s: string) => norm(s).split(" ").filter((w) => w.length > 3 && !/^(chapter|article|reading|handout|course|packet|textbook|assigned|from|with|that|this|what|makes|theory|practice)$/.test(w));

/** Same work? (a shared distinctive word: an author's name or a title word). */
export function sameWork(a: string, b: string): boolean {
  const A = new Set(keyWords(a));
  const B = keyWords(b);
  if (!A.size || !B.length) return norm(a) === norm(b);
  const shared = B.filter((w) => A.has(w)).length;
  return shared >= Math.min(2, Math.min(A.size, B.length));
}

const READING_WORD = String.raw`(?:read|handouts?|readings?|articles?|chapters?|essays?|excerpts?|short stor(?:y|ies)|stor(?:y|ies)|poems?|case(?: study)?|texts?|books?|novels?)`;
const QUOTED = String.raw`[“"‘']([^”"’']{4,90})[”"’']`;

/** Titles named in the sheet text ("the handout “Notes on the Quiet Kitchen”"). */
export function titlesInText(text: string): string[] {
  const t = (text ?? "").replace(/\s+/g, " ");
  const out: string[] = [];
  const word = new RegExp(String.raw`\b${READING_WORD}\b`, "i");
  const quoted = new RegExp(String.raw`${QUOTED}(?:,?\s+by\s+((?:[A-Z][\w.'-]*\s?){1,3}))?(\s*\([^)]*\))?`, "g");
  // Sentences that talk about readings: every quoted title in them (plus "(handout)"-tagged ones anywhere).
  for (const sentence of t.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
    const talks = word.test(sentence);
    for (const m of sentence.matchAll(quoted)) {
      const tagged = /\b(handout|reading|course packet|packet|textbook|chapter)\b/i.test(m[3] ?? "");
      if (!talks && !tagged) continue;
      const title = m[1]!.trim();
      if (/^(looks good|yes|no)$/i.test(title)) continue;
      out.push(m[2] ? `${title} by ${m[2].trim().replace(/[.,;]+$/, "")}` : title);
    }
  }
  // QA 3:51: an unquoted textbook chapter ("Using Chapter 6 of Myers' Psychology (memory)") is a named work too.
  for (const m of t.matchAll(/\b(?:Chapter|Ch\.)\s*\d{1,2}(?:\s*\([^)]{2,40}\))?\s+(?:of|in|from)\s+(?:the\s+)?[A-Z][\w-]+(?:'s|’s|'|’)\s+[A-Z][\w-]*(?:\s+[A-Z][\w-]*){0,4}(?:\s*\([^)]{2,40}\))?/g)) {
    out.push(m[0].trim());
  }
  return out;
}

/**
 * QA #84 (e1dd9fff, b3d40615): a "Readings: …" line names its works unquoted ("Readings: Northouse
 * ch. 4, pp. 45-70 and Goleman, What Makes a Leader? (HBR)."). Each one, without the instruction.
 */
export function readingsLineWorks(text: string): string[] {
  const t = (text ?? "").replace(/\s+/g, " ");
  const out: string[] = [];
  const line = /\b(?:(?:required|assigned|course)\s+)?(?:readings?|texts?|sources)\s*:\s*(.+?)(?=\.\s+[A-Z]|\.?$)/gi;
  for (const m of t.matchAll(line)) {
    const parts = m[1]!.split(/\s*;\s*|\s+and\s+(?=[A-Z][\w'’-]+(?:,|\s+(?:ch|chap|chapter)\b|'s|’s))/);
    for (const p of parts) {
      const w = stripLead(p).replace(/[.,;\s]+$/, "").trim();
      if (w.length >= 4 && /[A-Z]/.test(w)) out.push(w);
    }
  }
  return out;
}

/** Every named work, deduped, in sheet order (max 5). */
export function namedWorksFrom(req: ReqLike | null | undefined, sheetText = ""): string[] {
  const src = req?.requiredSources?.value;
  const fromNotes = (src?.notes ?? "").replace(/^\s*must (include|use|cite):?\s*/i, "").split(/;\s*/);
  const fromTypes = src?.types?.match(/(?:including|one must be|must include)\s+(?:the\s+)?(.+)$/i)?.[1]?.split(/;\s*|\s+and\s+(?=[A-Z“"'])/) ?? [];
  const provided = (req?.providedReadings?.value ?? []).filter((r) => r.origin !== "manual").map((r) => r.title ?? "").filter(Boolean);
  const text = [sheetText, req?.promptQuestion?.value ?? "", req?.otherInstructions?.value ?? ""].join(" ");
  const all = [...fromNotes, ...fromTypes, ...provided, ...titlesInText(text), ...readingsLineWorks(text)].map((x) => x.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "")).filter((x) => x.length >= 6);
  const out: string[] = [];
  for (const w of all) if (!out.some((o) => sameWork(o, w))) out.push(w);
  return out.slice(0, 5);
}

/** Short display name: "Notes on the Quiet Kitchen", "Goleman's “What Makes a Leader?”", "Northouse Ch. 4". */
export function displayWork(w: string): string {
  const t = w.replace(/\s+/g, " ").trim();
  const title = t.match(/[“"‘']([^”"’']{4,90})[”"’']/)?.[1];
  const by = t.match(/\bby\s+(?:[A-Z][\w.-]*\s+)*([A-Z][\w-]+)\b/)?.[1];
  const ch = t.match(/\b(?:chapter|ch\.?)\s*(\d+)/i)?.[1];
  const author = t.match(/\b([A-Z][\w-]+),\s+[A-Z]/)?.[1] ?? t.match(/^([A-Z][\w'’-]+)\s+(?:ch(?:ap)?\.?|chapter)\s*\d/i)?.[1];
  if (by && title) return `${by}'s “${title}”`;
  if (ch && (by || author)) return `${by ?? author} Ch. ${ch}`;
  if (title) return `“${title}”`;
  const bare = t.match(/^(.{4,70}?)\s+by\s+[A-Z]/)?.[1];
  if (bare && by) return `${by}'s “${bare}”`;
  return t.length <= 60 ? `“${t}”` : `“${t.slice(0, 57).replace(/\s+\S*$/, "")}…”`;
}

/** "Readings to cover: …" when the read-back didn't already name every one of them. */
export function readingsLine(works: string[], said: string): string | null {
  if (!works.length) return null;
  const s = norm(said);
  const missing = works.filter((w) => !keyWords(w).some((k) => s.includes(k)));
  if (!missing.length) return null;
  const names = works.map(displayWork);
  const list = names.length === 1 ? names[0]! : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
  return `Readings to cover: ${list}.`;
}

/**
 * QA #84 (e1dd9fff, b3d40615): the read-back's "must include" always lists every named work, in the
 * parse's own wording (so "Northouse ch. 4, pp. 45-70" keeps its comma and "Use …" never leaks in);
 * the model's other points follow. Deterministic, after the model.
 */
export function mustWithReadings(must: string[], works: string[]): string[] {
  const readings = works.map((w) => w.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 3);
  const rest = must.filter((m) => !readings.some((w) => sameWork(w, m)));
  return [...readings, ...rest].slice(0, Math.max(4, readings.length + 1));
}
