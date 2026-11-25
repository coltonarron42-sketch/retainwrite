/**
 * PC-31 (Colton t213u #3): the live "thinking" line while Pau works, like Grok's: short, student-friendly,
 * and tied to the real steps (searching, reading a site, pulling it together). Never internals, never her
 * reasoning text: only the search query (cleaned) and the site's name.
 */
import { sourceHost } from "@/lib/coach/sources-line";
import { isBlockedSource } from "@/lib/coach/reading-sources";

export type StatusKind = "research" | "reading" | "summary" | "think";

/** Rotating lines when no real step has happened yet (or between steps). */
export const STATUS_ROTATION: Record<StatusKind, string[]> = {
  research: ["Looking that up…", "Searching for good examples…", "Checking a few sources…", "Pulling it together…"],
  reading: ["Looking for your reading online…", "Checking the publisher's page…", "Seeing what's legit to use…", "Pulling it together…"],
  summary: ["Going over your readings…", "Picking out the key ideas…", "Tying it back to your paper…"],
  think: ["Thinking…", "Mulling over what you said…", "Getting my next question ready…"],
};

/** A search query as a status line: no operators, no URLs, a few words. */
export function searchingLine(query: unknown): string | null {
  if (typeof query !== "string") return null;
  const q = query
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b(?:site|filetype|inurl|intitle):\S+/gi, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length < 3) return null;
  const words = q.split(" ").slice(0, 8).join(" ");
  return `Searching for ${words.length > 64 ? `${words.slice(0, 63).trim()}` : words}…`;
}

export function readingLine(url: unknown): string | null {
  if (typeof url !== "string" || isBlockedSource(url)) return null;
  const host = sourceHost(url);
  return host ? `Reading ${host}…` : null;
}

export const WRITING_LINE = "Pulling it together…";
export const CHECKING_LINE = "Double-checking the sources…";

type Ev = Record<string, unknown>;
const obj = (v: unknown): Ev | null => (v && typeof v === "object" ? (v as Ev) : null);

/**
 * One Responses stream event → a status line (or null). Handles the web_search_call item (its action's
 * query and sources), URL citations, and the first text delta. Reasoning events are ignored on purpose.
 */
export function statusFromEvent(ev: Ev, seen: { writing?: boolean; hosts?: Set<string> } = {}): string[] {
  const type = String(ev.type ?? "");
  if (/reasoning/.test(type)) return [];
  const out: string[] = [];
  const item = obj(ev.item);
  if (item && item.type === "web_search_call") {
    const action = obj(item.action);
    const q = searchingLine(action?.query ?? (Array.isArray(action?.queries) ? (action!.queries as unknown[])[0] : null));
    if (q) out.push(q);
    const srcs = Array.isArray(action?.sources) ? (action!.sources as unknown[]) : [];
    for (const s of srcs.slice(0, 3)) {
      const line = readingLine(obj(s)?.url);
      const host = line ? line.slice(8, -1) : null;
      if (line && host && !seen.hosts?.has(host)) {
        seen.hosts?.add(host);
        out.push(line);
      }
    }
  } else if (/web_search_call\.(?:in_progress|searching)$/.test(type)) {
    out.push("Searching…");
  }
  const ann = obj(ev.annotation);
  if (ann && ann.type === "url_citation") {
    const line = readingLine(ann.url);
    const host = line ? line.slice(8, -1) : null;
    if (line && host && !seen.hosts?.has(host)) {
      seen.hosts?.add(host);
      out.push(line);
    }
  }
  if (type === "response.output_text.delta" && !seen.writing) {
    seen.writing = true;
    out.push(WRITING_LINE);
  }
  return out;
}
