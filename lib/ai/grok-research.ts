/**
 * PC-31 (Colton t207u): Pau's research turns. grok-4.3 on xAI's Responses API
 * with the built-in server-side web_search tool, so she can actually look things
 * up and summarize real sources. Pricing (xAI, Oct 2026): tokens at the model's
 * rate plus $5 per 1,000 successful web_search calls. Pay as you go on the same
 * key: no plan change. Never log the key or the request headers.
 * // SOP: coaching only, never generate submission text
 */
import type OpenAI from "openai";
import { getGrokClient } from "@/lib/ai/grok";
import { MODEL_FAST } from "@/lib/config";
import { statusFromEvent } from "@/lib/coach/thinking-status";

export type ResearchSource = { title: string; url: string };

export type ResearchResult =
  | { ok: true; text: string; raw: string; read: string[]; titles: Map<string, string>; sources: ResearchSource[]; searches: number; ms: number }
  | { ok: false; reason: string; ms: number; searches?: number; read?: string[]; titles?: Map<string, string> };

/** Cap per turn: she gets a few searches, not an open-ended crawl. */
export const MAX_SEARCH_CALLS = 3;
/** QA 3:32 speed: a reading lookup gets 2 (the reading by title and author, then the topic only if needed). */
export const READING_SEARCH_CALLS = 2;
/** t213u speed: plain research asks get 2 searches; a reading lookup keeps 3 (find the reading, then the topic). */
export const RESEARCH_SEARCH_CALLS = 2;

type AnyJson = Record<string, unknown>;

/** URL citations from Responses output items (and xAI's top-level `citations`, if present). */
export function extractSources(resp: AnyJson): ResearchSource[] {
  const out: ResearchSource[] = [];
  const add = (url: unknown, title: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
    if (out.some((s) => s.url === url)) return;
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* keep url */
    }
    out.push({ url, title: typeof title === "string" && title.trim() ? title.trim().slice(0, 140) : host });
  };
  const output = Array.isArray(resp.output) ? (resp.output as AnyJson[]) : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? (item.content as AnyJson[]) : [];
    for (const c of content) {
      const anns = Array.isArray(c.annotations) ? (c.annotations as AnyJson[]) : [];
      for (const a of anns) if (a.type === "url_citation") add(a.url, a.title);
    }
  }
  const cites = Array.isArray(resp.citations) ? (resp.citations as unknown[]) : [];
  for (const c of cites) {
    if (typeof c === "string") add(c, null);
    else if (c && typeof c === "object") add((c as AnyJson).url, (c as AnyJson).title);
  }
  return out.slice(0, 6);
}

/** Pages the web_search calls opened (action.sources), whether or not the reply cited them. */
export function readUrls(resp: AnyJson): string[] {
  const output = Array.isArray(resp.output) ? (resp.output as AnyJson[]) : [];
  const out: string[] = [];
  for (const o of output) {
    if (o.type !== "web_search_call") continue;
    const action = (o.action && typeof o.action === "object" ? o.action : {}) as AnyJson;
    for (const s of Array.isArray(action.sources) ? (action.sources as AnyJson[]) : []) if (typeof s?.url === "string") out.push(s.url);
  }
  if (Array.isArray(resp._read)) for (const u of resp._read as unknown[]) if (typeof u === "string") out.push(u);
  return [...new Set(out)];
}

/** The assistant text with its inline citations intact (for the per-bullet source check). */
export function rawText(resp: AnyJson): string {
  if (typeof resp.output_text === "string" && resp.output_text) return resp.output_text;
  const output = Array.isArray(resp.output) ? (resp.output as AnyJson[]) : [];
  return output
    .filter((o) => o.type === "message")
    .flatMap((o) => (Array.isArray(o.content) ? (o.content as AnyJson[]) : []))
    .map((c) => (typeof c.text === "string" ? c.text : ""))
    .join("\n");
}

export function countSearches(resp: AnyJson): number {
  const output = Array.isArray(resp.output) ? (resp.output as AnyJson[]) : [];
  return output.filter((o) => o.type === "web_search_call").length;
}

/** The final assistant text, without inline markdown links or bare URLs (the app shows links itself). */
export function researchText(resp: AnyJson): string {
  let text = typeof resp.output_text === "string" ? resp.output_text : "";
  if (!text) {
    const output = Array.isArray(resp.output) ? (resp.output as AnyJson[]) : [];
    text = output
      .filter((o) => o.type === "message")
      .flatMap((o) => (Array.isArray(o.content) ? (o.content as AnyJson[]) : []))
      .map((c) => (typeof c.text === "string" ? c.text : ""))
      .join("\n");
  }
  return text
    .replace(/\[\[\d+\]\]\([^)]*\)/g, "")
    .replace(/\[([^\]]{1,120})\]\((https?:[^)]+)\)/g, "$1")
    .replace(/\(?https?:\/\/\S+\)?/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function grokResearch(opts: {
  system: string;
  user: string;
  effort: "high" | "low" | "none";
  search: boolean;
  timeoutMs: number;
  /** Max web searches this turn (default MAX_SEARCH_CALLS). */
  maxSearches?: number;
  /** PC-31 t213u: stream the response and report the real steps (searching, reading a site, writing). */
  onStatus?: (line: string) => void;
  /** What she's looking for, in the student's words (the stream doesn't carry the query). */
  topic?: string | null;
  /** QA 3:46: search only these sites (max 5), e.g. the good pages she read but didn't use. */
  allowedDomains?: string[];
}): Promise<ResearchResult> {
  const started = Date.now();
  const grok = getGrokClient();
  if (!grok) return { ok: false, reason: "missing_key", ms: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const body: AnyJson = {
    model: MODEL_FAST,
    instructions: opts.system,
    input: [{ role: "user", content: opts.user }],
    ...(opts.search
      ? {
          tools: [{ type: "web_search", ...(opts.allowedDomains?.length ? { filters: { allowed_domains: opts.allowedDomains.slice(0, 5) } } : {}) }],
          max_tool_calls: opts.maxSearches ?? MAX_SEARCH_CALLS,
        }
      : {}),
    reasoning: { effort: opts.effort },
    store: false,
  };
  const cap = opts.search ? (opts.maxSearches ?? MAX_SEARCH_CALLS) : 0;
  const titles = new Map<string, string>();
  const addTitle = (s: AnyJson | null | undefined) => {
    if (!s || typeof s.url !== "string") return;
    const t = [s.title, s.snippet, s.description, s.text].filter((x) => typeof x === "string" && x.trim()).join(" — ");
    if (t && !titles.has(s.url)) titles.set(s.url, t.slice(0, 600));
  };
  const call = async (b: AnyJson): Promise<AnyJson> => {
    // QA 4:08: always stream a search turn, so the per-turn cap is enforced here (not only by max_tool_calls).
    if (!opts.onStatus && !opts.search) return (await grok.responses.create(b as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming, { signal: controller.signal, timeout: opts.timeoutMs })) as unknown as AnyJson;
    const stream = (await grok.responses.create({ ...(b as object), stream: true } as unknown as OpenAI.Responses.ResponseCreateParamsStreaming, { signal: controller.signal, timeout: opts.timeoutMs })) as unknown as AsyncIterable<AnyJson>;
    const seen = { writing: false, hosts: new Set<string>(), topic: opts.topic ?? null, searched: 0 };
    const types = new Set<string>();
    let final: AnyJson | null = null;
    let text = "";
    const read: string[] = [];
    const callIds = new Set<string>();
    const actions: { type: string; queries: number; sources: number }[] = [];
    let capped = false;
    for await (const ev of stream) {
      const type = String(ev.type ?? "");
      types.add(type);
      const it = ev.item && typeof ev.item === "object" ? (ev.item as AnyJson) : null;
      if (it?.type === "web_search_call") {
        if (typeof it.id === "string") callIds.add(it.id);
        const action = it.action && typeof it.action === "object" ? (it.action as AnyJson) : null;
        if (action) {
          for (const s of Array.isArray(action.sources) ? (action.sources as AnyJson[]) : []) {
            if (typeof s?.url === "string") read.push(s.url);
            addTitle(s);
          }
          if (type === "response.output_item.done")
            actions.push({ type: String(action.type ?? "?"), queries: Array.isArray(action.queries) ? action.queries.length : action.query ? 1 : 0, sources: Array.isArray(action.sources) ? action.sources.length : 0 });
        }
      }
      if (/web_search_call\./.test(type) && typeof ev.item_id === "string") callIds.add(ev.item_id);
      if (type === "response.output_text.annotation.added" && ev.annotation && typeof ev.annotation === "object") addTitle(ev.annotation as AnyJson);
      // Hard cap: a search past this turn's budget ends the request; the route answers from the pages already read.
      if (cap && callIds.size > cap) {
        capped = true;
        break;
      }
      for (const line of statusFromEvent(ev, seen)) opts.onStatus?.(line);
      if (type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
      if ((type === "response.completed" || type === "response.done") && ev.response && typeof ev.response === "object") final = ev.response as AnyJson;
    }
    if (capped) controller.abort();
    const usage = final && typeof final === "object" ? ((final as AnyJson).server_side_tool_usage ?? ((final as AnyJson).usage as AnyJson | undefined)?.server_side_tool_usage_details ?? null) : null;
    // Event names and search-call shapes only (never content).
    console.info("[grok-research] stream", { cap, calls: callIds.size, capped, actions, usage, types: [...types].filter((t) => !/delta|reasoning/.test(t)).slice(0, 20) });
    // Billed count when xAI reports it (server_side_tool_usage.web_search_calls), else the distinct calls we saw.
    const billed = usage && typeof (usage as AnyJson).web_search_calls === "number" ? ((usage as AnyJson).web_search_calls as number) : null;
    return { ...(final ?? { output_text: capped ? "" : text, output: [] }), _searched: billed ?? callIds.size, _read: read, _capped: capped };
  };
  try {
    let resp: AnyJson;
    try {
      resp = await call(body);
    } catch (err) {
      // If the API rejects the capped search request, retry once WITHOUT web search (t218u: never uncapped).
      if ((err as { status?: number } | null)?.status !== 400 || !opts.search) throw err;
      const { max_tool_calls: _drop, tools: _tools, ...rest } = body;
      void _drop;
      void _tools;
      console.warn("[grok-research] retry without web search");
      resp = await call(rest);
    }
    clearTimeout(timer);
    const text = researchText(resp);
    const sources = extractSources(resp);
    const searches = typeof resp._searched === "number" ? resp._searched : countSearches(resp);
    for (const o of Array.isArray(resp.output) ? (resp.output as AnyJson[]) : []) {
      for (const c of Array.isArray(o.content) ? (o.content as AnyJson[]) : []) for (const a of Array.isArray(c.annotations) ? (c.annotations as AnyJson[]) : []) addTitle(a);
    }
    if (resp._capped) return { ok: false, reason: "capped", searches, read: readUrls(resp), titles, ms: Date.now() - started };
    return text ? { ok: true, text, raw: rawText(resp), read: readUrls(resp), titles, sources, searches, ms: Date.now() - started } : { ok: false, reason: "empty", searches, ms: Date.now() - started };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : "grok_error";
    const status = (err as { status?: number } | null)?.status ?? null;
    console.warn("[grok-research] failed", { ms: Date.now() - started, status, timeout: /abort|timeout/i.test(message), message: message.slice(0, 160) });
    return { ok: false, reason: /abort|timeout/i.test(message) ? "timeout" : "request_failed", ms: Date.now() - started };
  }
}
