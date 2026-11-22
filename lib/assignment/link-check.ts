import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LinkCheck = { ok: true; finalUrl: string } | { ok: false; reason: "invalid" | "private" | "dns" | "not_found" | "unreachable" };

/** Private, loopback, link-local and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    return a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80") || a === "::" || a.startsWith("::ffff:127.") || a.startsWith("::ffff:10.") || a.startsWith("::ffff:192.168.");
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

/**
 * Is this a real, public page we can reach? DNS first, then one request with
 * a short timeout. Paywalls and bot blocks (401/403/429) still count as a real
 * page; 404/410 and network failures do not.
 */
export async function checkLink(raw: string, timeoutMs = 5000): Promise<LinkCheck> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return { ok: false, reason: "invalid" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Follow up to 4 redirects by hand so every hop is checked for a public address.
    for (let hop = 0; hop < 5; hop++) {
      const host = await publicHost(url);
      if (host !== "ok") return { ok: false, reason: host };
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RetainWrite link check)", Accept: "text/html,application/pdf,*/*" },
      });
      void res.body?.cancel().catch(() => undefined);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url);
        if (!/^https?:$/.test(url.protocol)) return { ok: false, reason: "invalid" };
        continue;
      }
      if (res.status === 404 || res.status === 410) return { ok: false, reason: "not_found" };
      if (res.status >= 500 && res.status !== 503) return { ok: false, reason: "unreachable" };
      return { ok: true, finalUrl: url.toString() };
    }
    return { ok: false, reason: "unreachable" };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

async function publicHost(url: URL): Promise<"ok" | "private" | "dns"> {
  if (isIP(url.hostname)) return "private";
  if (/(^|\.)(localhost|local|internal|invalid|test|example)$/i.test(url.hostname)) return "dns";
  try {
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length) return "dns";
    if (addresses.some((entry) => isPrivateAddress(entry.address))) return "private";
    return "ok";
  } catch {
    return "dns";
  }
}
