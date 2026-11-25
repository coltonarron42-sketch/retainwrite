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

export type ResearchSource = { title: string; url: string };

export type ResearchResult =
  | { ok: true; text: string; sources: ResearchSource[]; searches: number; ms: number }
  | { ok: false; reason: string; ms: number };

/** Cap per turn: she gets a few searches, not an open-ended crawl. */
export const MAX_SEARCH_CALLS = 3;

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
  effort: "high" | "none";
  search: boolean;
  timeoutMs: number;
}): Promise<ResearchResult> {
  const started = Date.now();
  const grok = getGrokClient();
  if (!grok) return { ok: false, reason: "missing_key", ms: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const body = {
      model: MODEL_FAST,
      instructions: opts.system,
      input: [{ role: "user", content: opts.user }],
      ...(opts.search ? { tools: [{ type: "web_search" }], max_tool_calls: MAX_SEARCH_CALLS } : {}),
      reasoning: { effort: opts.effort },
      store: false,
    } as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming;
    let resp: AnyJson;
    try {
      resp = (await grok.responses.create(body, { signal: controller.signal, timeout: opts.timeoutMs })) as unknown as AnyJson;
    } catch (err) {
      // If the API doesn't take max_tool_calls, retry once without it (the prompt still asks for a few searches).
      if ((err as { status?: number } | null)?.status !== 400 || !opts.search) throw err;
      const { max_tool_calls: _drop, ...rest } = body as unknown as AnyJson;
      void _drop;
      console.warn("[grok-research] retry without max_tool_calls");
      resp = (await grok.responses.create(rest as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming, { signal: controller.signal, timeout: opts.timeoutMs })) as unknown as AnyJson;
    }
    clearTimeout(timer);
    const text = researchText(resp);
    const sources = extractSources(resp);
    const searches = countSearches(resp);
    return text ? { ok: true, text, sources, searches, ms: Date.now() - started } : { ok: false, reason: "empty", ms: Date.now() - started };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : "grok_error";
    const status = (err as { status?: number } | null)?.status ?? null;
    console.warn("[grok-research] failed", { ms: Date.now() - started, status, timeout: /abort|timeout/i.test(message), message: message.slice(0, 160) });
    return { ok: false, reason: /abort|timeout/i.test(message) ? "timeout" : "request_failed", ms: Date.now() - started };
  }
}
