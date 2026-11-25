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

/**
 * xAI's stream doesn't carry the search query, so the "Searching for …" line names the student's own ask,
 * cleaned to a few words ("find me examples of servant leadership in business" → "examples of servant
 * leadership in business").
 */
export function askTopic(message: string): string | null {
  const t = message
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*(?:hey|hi|ok(?:ay)?|so|pau)[,!.\s]+/i, "")
    .replace(/^\s*(?:can|could|would) you\s+(?:please\s+)?/i, "")
    .replace(/^\s*(?:please\s+)?(?:find|get|give|show|look up|search for|pull up|dig up)\s+(?:me\s+)?(?:some\s+)?/i, "")
    .replace(/^\s*what (?:does|do|did) (.+?) (?:say|says) about (.+)$/i, "what $1 says about $2")
    .replace(/^\s*what (?:does|do|did) (.+?) say\b\s*\??$/i, "what $1 says")
    .replace(/^\s*(?:what|who)\s+(?:is|are)\s+/i, "")
    .replace(/[?.!]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  // A rambly or multi-sentence ask ("I don't think this is working. Okay. Can…") makes a bad status line.
  if (t.length < 4 || /[.!?]\s/.test(t) || /^(?:i|i'm|i've|okay|ok|so|um|uh|well)\b/i.test(t)) return null;
  const words = t.split(" ").slice(0, 8).join(" ");
  return words.length > 60 ? words.slice(0, 59).trim() : words;
}

export const WRITING_LINE = "Pulling it together…";
export const CHECKING_LINE = "Double-checking the sources…";

type Ev = Record<string, unknown>;
const obj = (v: unknown): Ev | null => (v && typeof v === "object" ? (v as Ev) : null);

/**
 * One Responses stream event → a status line (or null). Handles the web_search_call item (its action's
 * query and sources), URL citations, and the first text delta. Reasoning events are ignored on purpose.
 */
export function statusFromEvent(ev: Ev, seen: { writing?: boolean; hosts?: Set<string>; topic?: string | null; searched?: number } = {}): string[] {
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
  } else if (/web_search_call\.searching$/.test(type)) {
    seen.searched = (seen.searched ?? 0) + 1;
    out.push(seen.topic ? (seen.searched === 1 ? `Searching for ${seen.topic}…` : `Searching a bit more on ${seen.topic}…`) : "Searching…");
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
