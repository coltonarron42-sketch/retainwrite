/**
 * Fetch a public web page's readable text, server-side, behind the same public-
 * address link check as every other link (no private hosts, every redirect hop
 * re-checked by checkLink). HTML and plain text only; PDFs ask for an upload.
 */
import { checkLink } from "@/lib/assignment/link-check";

export type PageText = { ok: true; url: string; title: string; text: string } | { ok: false; reason: "link" | "pdf" | "empty" | "type" | "fetch" };

const MAX_BYTES = 3_000_000;

export function htmlToPlain(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
  const lines = body
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    // Menus and buttons are short; keep sentences.
    .filter((l) => l.length >= 40 || /[.!?]$/.test(l));
  return { title: decode(title), text: lines.join("\n") };
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

export async function fetchPageText(raw: string, timeoutMs = 8000): Promise<PageText> {
  const check = await checkLink(raw, 5000);
  if (!check.ok) return { ok: false, reason: "link" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(check.finalUrl, {
      redirect: "error",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RetainWrite reader)", Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
    });
    if (!res.ok) return { ok: false, reason: "fetch" };
    const type = res.headers.get("content-type") ?? "";
    if (/pdf/i.test(type)) return { ok: false, reason: "pdf" };
    if (!/html|text\/plain|xml/i.test(type)) return { ok: false, reason: "type" };
    const buf = await res.arrayBuffer();
    const str = new TextDecoder().decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
    const page = /html|xml/i.test(type) ? htmlToPlain(str) : { title: "", text: str.replace(/[ \t]+/g, " ").trim() };
    if (page.text.split(/\s+/).length < 80) return { ok: false, reason: "empty" };
    return { ok: true, url: check.finalUrl, title: page.title, text: page.text };
  } catch {
    return { ok: false, reason: "fetch" };
  } finally {
    clearTimeout(timer);
  }
}
