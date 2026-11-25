/**
 * PC-31 QA 3:46: source ranking and filter for Pau's researched replies (in code, not only the prompt).
 * Bullets keep only when they rest on a source that passes (tier >= 2); good sources come first in the
 * Sources line; bare domains at the end of bullets become one clean attribution.
 */
import { SOURCE_QUALITY as Q } from "@/lib/coach/source-quality.config";

export type Src = { title: string; url: string };
export type Tier = 0 | 1 | 2 | 3;

export function hostOf(urlOrHost: string): string {
  const s = urlOrHost.trim();
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
const under = (host: string, d: string) => (d.includes(".") ? host === d || host.endsWith(`.${d}`) : host.includes(d));

/** Tier for a URL (or a bare host). `about` = the bullet's text, for a company's own site. */
export function sourceTier(urlOrHost: string, about = ""): Tier {
  const host = hostOf(urlOrHost);
  if (!host) return 0;
  let path = "";
  try {
    path = new URL(/^https?:\/\//i.test(urlOrHost) ? urlOrHost : `https://${urlOrHost}`).pathname.toLowerCase();
  } catch {
    /* host only */
  }
  if (Q.blocked.some((d) => under(host, d))) return 0;
  const pdf = /\.pdf$/.test(path);
  const strong = Q.strong.some((d) => under(host, d));
  if (pdf && !strong && Q.libraryHost.test(host)) return 0;
  if (strong) return 3;
  if (Q.fine.some((d) => under(host, d))) return 2;
  const academic = /\.(?:edu|gov)$|\.(?:edu|ac|gov)\.[a-z]{2}$|\.ac\.uk$|\.gc\.ca$|\.gov\.uk$/.test(host);
  if (academic) {
    if (pdf && !/\.(?:edu|gov)$/.test(host)) return 1; // a textbook PDF on a foreign university server
    if (Q.eduMarketingHost.test(host)) return 1;
    return 2;
  }
  // A company's own site, for a bullet about that company ("Southwest Airlines" → southwest.com).
  if (about) {
    const label = host.split(".").slice(-2, -1)[0] ?? "";
    const squashed = about.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (label.length >= 4 && squashed.includes(label)) return 2;
  }
  return 1;
}

export const passes = (urlOrHost: string, about = "") => sourceTier(urlOrHost, about) >= 2;

export function sourceName(urlOrHost: string): string {
  const host = hostOf(urlOrHost);
  const key = Object.keys(Q.names).sort((a, b) => b.length - a.length).find((d) => under(host, d));
  return key ? Q.names[key]! : host;
}

const DOMAIN = "(?:[a-z0-9-]+\\.)+(?:com|org|edu|net|gov|io|co|uk|ca|au|int|iq|in|de|fr|info|pub)";
const CITE = /\[\[\d+\]\]\((https?:[^)\s]+)\)|\[([^\]]{1,140})\]\((https?:[^)\s]+)\)|(https?:\/\/[^\s)\]]+)/g;
const TAIL = new RegExp(`\\s*(?:[–—-]\\s*)?(?:\\[\\s*|\\(\\s*)?(?:(?:Sources?|via|per)\\s*:?\\s*)?((?:${DOMAIN})(?:\\s*(?:,|and|&|;)\\s*${DOMAIN})*)\\s*[\\])]?\\.?\\s*$`, "i");

/** The URLs and site names one line rests on. */
export function lineCites(line: string): { urls: string[]; hosts: string[] } {
  const urls: string[] = [];
  for (const m of line.matchAll(CITE)) {
    const u = m[1] ?? m[3] ?? m[4];
    if (u) urls.push(u);
  }
  const bare = line.replace(CITE, " ");
  const hosts = [...bare.matchAll(new RegExp(`\\b${DOMAIN}\\b`, "gi"))].map((m) => hostOf(m[0])).filter(Boolean);
  return { urls, hosts: [...new Set([...urls.map(hostOf), ...hosts])] };
}

/** The line without its citations and its trailing site tag. */
export function stripCites(line: string): string {
  return line
    .replace(CITE, (_m, _a, title: string | undefined) => (title ? title : ""))
    .replace(TAIL, "")
    .replace(/\s*\bSources?:\s*$/i, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/([^.!?])$/, "$1.");
}

export const READING_WEAK_LEAD = "I couldn't find a page for your reading I'd trust, so here's the general idea (not from your copy):";

/** "From library.x.edu.iq's page, not your copy:" → "Not your copy:" style: the site mention goes. */
export function dropSiteMentions(line: string): string {
  return line
    .replace(CITE, (_m, _a, t: string | undefined) => t ?? "")
    .replace(new RegExp(`\\s*(?:\\b(?:from|on|at|via|per|according to)\\s+)?(?:the\\s+)?${DOMAIN}(?:['’]s)?(?:\\s+(?:page|pages|site|article))?`, "gi"), "")
    .replace(/^\s*[,;:]\s*/, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/^([a-z])/, (c) => c.toUpperCase());
}

export type QualityResult = {
  text: string;
  sources: Src[];
  kept: number;
  dropped: { line: string; hosts: string[] }[];
  /** Good pages she read but didn't cite (for a retry restricted to them). */
  goodUnused: string[];
};

const BULLET = /^\s*(?:[•*-]|\d{1,2}[.)])\s+/;

/**
 * Filters a researched reply. research: every bullet must rest on a passing source (uncited bullets go).
 * reading: bullets citing only failing sources go; uncited bullets stay under a passing (or unsourced) lead line.
 */
export function applySourceQuality(raw: string, o: { mode: "research" | "reading"; sources: Src[]; read?: string[] }): QualityResult {
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const dropped: QualityResult["dropped"] = [];
  const used = new Map<string, Tier>();
  let leadOk = true;
  let seenBullet = false;
  const out: string[] = [];
  for (const line of lines) {
    const bullet = BULLET.test(line);
    const { urls, hosts } = lineCites(line);
    // A bare site name resolves to the page she actually read there (a PDF path matters).
    const known = [...o.sources.map((s) => s.url), ...(o.read ?? [])];
    const cited = [...new Set([...urls, ...hosts.filter((h) => !urls.some((u) => hostOf(u) === h)).map((h) => known.find((u) => hostOf(u) === h) ?? h)])];
    const best = cited.reduce<{ t: Tier; u: string | null }>((acc, u) => {
      const t = sourceTier(u, line);
      return t > acc.t ? { t, u } : acc;
    }, { t: 0, u: null });
    if (!bullet) {
      if (cited.length && best.t < 2) {
        if (!seenBullet) leadOk = false;
        // A reading lead resting on a weak or pirated page: say plainly it isn't from a page we'd trust.
        if (o.mode === "reading" && !seenBullet) out.push(READING_WEAK_LEAD);
        else out.push(dropSiteMentions(line));
        continue;
      }
      out.push(line.replace(CITE, (_m, _a, t: string | undefined) => t ?? "").replace(/[ \t]{2,}/g, " ").trim());
      continue;
    }
    seenBullet = true;
    const ok = cited.length ? best.t >= 2 : o.mode === "reading" && leadOk;
    if (!ok) {
      dropped.push({ line, hosts: cited.map(hostOf) });
      continue;
    }
    for (const u of cited) {
      const t = sourceTier(u, line);
      if (t >= 2) used.set(hostOf(u), Math.max(used.get(hostOf(u)) ?? 0, t) as Tier);
    }
    const body = stripCites(line.replace(BULLET, ""));
    // One clean attribution, only when the bullet rests on a specific source (research bullets).
    const attr = o.mode === "research" && best.u ? ` (${sourceName(best.u)})` : "";
    out.push(`• ${body.replace(/\.$/, "")}${attr}.`);
  }
  const rank = (s: Src, about = "") => sourceTier(s.url, about);
  const passing = o.sources.filter((s) => used.has(hostOf(s.url)) || rank(s) >= 2);
  passing.sort((a, b) => Number(used.has(hostOf(b.url))) - Number(used.has(hostOf(a.url))) || rank(b) - rank(a));
  const goodUnused = [...new Set((o.read ?? []).filter((u) => sourceTier(u) >= 2).map(hostOf))].filter((h) => !used.has(h));
  return { text: out.join("\n"), sources: passing, kept: out.filter((l) => l.startsWith("• ")).length, dropped, goodUnused };
}

/** When nothing citable came back: say so plainly, keep the gist as labeled background (no sites). */
export function noGoodSourcesParas(dropped: { line: string }[], question: string | null): string[] {
  const gist = dropped
    .slice(0, 3)
    .map((d) => `• ${stripCites(d.line.replace(BULLET, "")).replace(/\.$/, "")}.`)
    .filter((l) => l.length > 6);
  return [
    "I couldn't find sources I'd want you to cite on this one. What came up were summary and blog sites, so here's general background instead (not something to cite):",
    ...gist,
    "For citable examples, try Google Scholar or your library's business databases, or ask me to look for a specific leader or company.",
    ...(question ? [question] : []),
  ];
}
