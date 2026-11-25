/**
 * PC-31 QA 4:08: what a cited page actually says, for the attribution check. We fetch the page Pau
 * cited (public https only, short timeout, first ~400 KB) and keep its title, description and text.
 * A page behind a bot wall (401/403/429) gives no text; the check then uses its title and URL words.
 */
const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;
const MAX_BYTES = 400_000;

export type PageEvidence = { url: string; status: number; title: string; text: string };

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)));

export function htmlEvidence(html: string): { title: string; text: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const metas = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|citation_title|dc\.title|twitter:title)["'][^>]*>/gi)]
    .map((m) => m[0].match(/content=["']([^"']{1,600})["']/i)?.[1] ?? "")
    .map(decode);
  const body = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  return { title, text: `${metas.join(" ")} ${body}`.slice(0, 200_000) };
}

async function fetchOne(url: string, timeoutMs: number): Promise<PageEvidence | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || BLOCKED_HOST.test(u.hostname) || !u.hostname.includes(".")) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(u, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 RetainWrite source check", accept: "text/html,application/xhtml+xml" } });
    if (!res.ok || !/html|xml|text/i.test(res.headers.get("content-type") ?? "")) return { url, status: res.status, title: "", text: "" };
    const reader = res.body?.getReader();
    if (!reader) return { url, status: res.status, title: "", text: "" };
    const chunks: Uint8Array[] = [];
    let n = 0;
    while (n < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      n += value.length;
    }
    void reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { url, status: res.status, ...htmlEvidence(html) };
  } catch {
    return { url, status: 0, title: "", text: "" };
  } finally {
    clearTimeout(t);
  }
}

/** Fetches up to `max` pages in parallel; whatever isn't back by `timeoutMs` counts as no text. */
export async function fetchEvidence(urls: string[], o: { timeoutMs?: number; max?: number } = {}): Promise<Map<string, PageEvidence>> {
  const list = [...new Set(urls)].slice(0, o.max ?? 8);
  const out = new Map<string, PageEvidence>();
  const got = await Promise.all(list.map((u) => fetchOne(u, o.timeoutMs ?? 3_500)));
  for (const g of got) if (g) out.set(g.url, g);
  return out;
}
