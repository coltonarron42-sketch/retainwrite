export type SourceLink = { title: string; url: string; why?: string };

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

/** Real, reachable, public https links only (PLAN.md 9: never made-up sources). */
export async function checkLinks(links: SourceLink[], timeoutMs = 2_500): Promise<SourceLink[]> {
  const checks = links.map(async (l): Promise<SourceLink | null> => {
    let u: URL;
    try {
      u = new URL(String(l.url));
    } catch {
      return null;
    }
    if (u.protocol !== "https:" || BLOCKED_HOST.test(u.hostname) || !u.hostname.includes(".")) return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      let res = await fetch(u, { method: "HEAD", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 RetainWrite link check" } });
      if (res.status === 405 || res.status === 501) res = await fetch(u, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 RetainWrite link check" } });
      // 404/410 and server errors mean dead or invented; 401/403/429 are real pages behind bot walls.
      if (res.status === 404 || res.status === 410 || res.status >= 500) return null;
      return { title: String(l.title).slice(0, 140), url: u.toString(), why: l.why ? String(l.why).slice(0, 120) : undefined };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  });
  return (await Promise.all(checks)).filter((x): x is SourceLink => Boolean(x));
}
