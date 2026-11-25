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

export type AttributionCheck = { bullet: string; tag: string; page: string; pageTitle: string; supported: boolean; retagged: boolean; terms: string[] };

export type QualityResult = {
  text: string;
  sources: Src[];
  kept: number;
  dropped: { line: string; hosts: string[]; why?: "weak" | "unsupported" }[];
  checks: AttributionCheck[];
  /** Good pages she read but didn't cite (for a retry restricted to them). */
  goodUnused: string[];
};

const BULLET = /^\s*(?:[•*-]|\d{1,2}[.)])\s+/;

const GENERIC = new Set(
  "the a an and of in on at for to with by from as is it its this that these those he she they his her their our your my we you i who what why how when where which servant transformational situational leadership leader leaders leading led style styles approach theory chapter article study studies research journal review harvard business hbr mit sloan management case example examples company companies ceo team teams change organizational organization one two three first second new real source sources page site during through after before while also used uses using showed shows show built builds put puts".split(" "),
);
const norm = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

/** The bullet's key entities (people, companies: capitalized runs) and its content words. */
export function keyTerms(bullet: string): { entities: string[]; words: string[] } {
  const body = stripCites(bullet.replace(BULLET, "")).replace(/\([^)]*\)\.?$/, "").replace(/['’]s\b/g, "");
  const entities: string[] = [];
  for (const m of body.matchAll(/\b(?:[A-Z][a-zA-Z’'&.-]+|[A-Z]{2,})(?:\s+(?:of\s+|de\s+|&\s+)?(?:[A-Z][a-zA-Z’'&.-]+|[A-Z]{2,}))*/g)) {
    const toks = norm(m[0]).trim().split(" ").filter((t) => t.length >= 3 && !GENERIC.has(t));
    if (toks.length) entities.push(toks.join(" "));
  }
  const words = [...new Set(norm(body).trim().split(" ").filter((t) => t.length >= 5 && !GENERIC.has(t)))];
  return { entities: [...new Set(entities)], words };
}

/**
 * QA 4:08: does this page support the bullet? Its key entity (a named leader or company) must appear in
 * the page's title, description or text; a bullet without names needs most of its content words there.
 */
export function supportedBy(bullet: string, evidence: string): boolean {
  const ev = norm(evidence);
  if (ev.trim().length < 3) return false;
  const { entities, words } = keyTerms(bullet);
  const has = (t: string) => ev.includes(` ${t} `);
  if (entities.length) return entities.some((e) => e.split(" ").every(has));
  if (!words.length) return false;
  const hit = words.filter(has).length;
  return hit >= Math.min(3, Math.ceil(words.length * 0.5));
}

/** The evidence for a page: what we fetched, plus the citation's own title and the URL's words. */
export function evidenceFor(url: string, o: { fetched?: Map<string, { title: string; text: string }>; titles?: Map<string, string> }): { title: string; text: string } {
  const f = o.fetched?.get(url);
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(url).pathname).replace(/[-_/.]+/g, " ");
  } catch {
    /* none */
  }
  const t = o.titles?.get(url) ?? "";
  const title = f?.title || (/^https?:/i.test(t) ? "" : t);
  return { title, text: `${title} ${t} ${slug} ${f?.text ?? ""}` };
}

/**
 * Filters a researched reply. research: every bullet must rest on a passing source (uncited bullets go).
 * reading: bullets citing only failing sources go; uncited bullets stay under a passing (or unsourced) lead line.
 */
export function applySourceQuality(
  raw: string,
  o: {
    mode: "research" | "reading";
    sources: Src[];
    read?: string[];
    /** QA 4:08: page text we fetched (url → title/text). With it, every cited bullet gets a support check. */
    fetched?: Map<string, { title: string; text: string }>;
    /** Pages that never mention what they asked about (QA retest minor: loosely related links drop). */
    offTopic?: Set<string>;
    titles?: Map<string, string>;
  },
): QualityResult {
  const tierOf = (u: string, about = ""): Tier => (o.offTopic?.has(u) ? (Math.min(1, sourceTier(u, about)) as Tier) : sourceTier(u, about));
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const dropped: QualityResult["dropped"] = [];
  const checks: AttributionCheck[] = [];
  const used = new Map<string, Tier>();
  const usedUrls: string[] = [];
  const check = Boolean(o.fetched);
  const known = [...new Set([...o.sources.map((s) => s.url), ...(o.read ?? [])])];
  let leadOk = true;
  let seenBullet = false;
  const out: string[] = [];
  for (const line of lines) {
    const bullet = BULLET.test(line);
    const { urls, hosts } = lineCites(line);
    // A bare site name resolves to the page she actually read there (a PDF path matters).
    const cited = [...new Set([...urls, ...hosts.filter((h) => !urls.some((u) => hostOf(u) === h)).map((h) => known.find((u) => hostOf(u) === h) ?? h)])];
    const about = dropSiteMentions(line);
    const best = cited.reduce<{ t: Tier; u: string | null }>((acc, u) => {
      const t = tierOf(u, about);
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
      // QA 4:08: a reading lead ("From SAGE's page for Northouse…") must be backed by a good page she read.
      if (check && o.mode === "reading" && !seenBullet && /\b(?:from|per|according to)\b/i.test(line) && keyTerms(line).entities.length) {
        const pages = known.filter((u) => tierOf(u, about) >= 2);
        const hit = pages.find((u) => supportedBy(line, evidenceFor(u, o).text));
        checks.push({ bullet: stripCites(line).slice(0, 160), tag: "lead", page: hit ?? pages[0] ?? "", pageTitle: evidenceFor(hit ?? pages[0] ?? "", o).title.slice(0, 140), supported: Boolean(hit), retagged: false, terms: keyTerms(line).entities.slice(0, 4) });
        if (!hit) {
          leadOk = false;
          out.push(READING_WEAK_LEAD);
          continue;
        }
      }
      out.push(line.replace(CITE, (_m, _a, t: string | undefined) => t ?? "").replace(/[ \t]{2,}/g, " ").trim());
      continue;
    }
    seenBullet = true;
    let ok = cited.length ? best.t >= 2 : o.mode === "reading" && leadOk;
    let page = best.u;
    if (!ok && check && cited.length) {
      // A bullet tagged to a weak site: re-tag it to a good page she read that does back it up.
      const alt = known.find((u) => tierOf(u, about) >= 2 && supportedBy(line, evidenceFor(u, o).text));
      checks.push({
        bullet: stripCites(line.replace(BULLET, "")).slice(0, 160),
        tag: hostOf(best.u ?? cited[0] ?? ""),
        page: alt ?? best.u ?? cited[0] ?? "",
        pageTitle: evidenceFor(alt ?? best.u ?? "", o).title.slice(0, 140),
        supported: Boolean(alt),
        retagged: Boolean(alt),
        terms: keyTerms(line).entities.slice(0, 4),
      });
      if (alt) {
        ok = true;
        page = alt;
        usedUrls.push(alt);
        used.set(hostOf(alt), tierOf(alt, about));
        const body = stripCites(line.replace(BULLET, ""));
        out.push(`• ${body.replace(/\.$/, "")}${o.mode === "research" ? ` (${sourceName(alt)})` : ""}.`);
        continue;
      }
    }
    if (!ok) {
      dropped.push({ line, hosts: cited.map(hostOf), why: "weak" });
      continue;
    }
    if (check && cited.length) {
      // Every passing page she could mean: the cited ones (a bare [hbr.org] tag covers each hbr.org page she read).
      const tagged = [...new Set(cited.flatMap((c) => (/^https?:/i.test(c) ? [c] : known.filter((k) => hostOf(k) === hostOf(c)))).filter((u) => /^https?:/i.test(u) && tierOf(u, about) >= 2))];
      const others = known.filter((u) => !tagged.includes(u) && tierOf(u, about) >= 2);
      const hit = tagged.find((u) => supportedBy(line, evidenceFor(u, o).text));
      const re = hit ? null : others.find((u) => supportedBy(line, evidenceFor(u, o).text));
      const chosen = hit ?? re ?? null;
      const shown = chosen ?? tagged[0] ?? best.u ?? "";
      checks.push({
        bullet: stripCites(line.replace(BULLET, "")).slice(0, 160),
        tag: hostOf(best.u ?? cited[0] ?? ""),
        page: shown,
        pageTitle: evidenceFor(shown, o).title.slice(0, 140),
        supported: Boolean(chosen),
        retagged: Boolean(re),
        terms: keyTerms(line).entities.slice(0, 4),
      });
      if (!chosen) {
        dropped.push({ line, hosts: cited.map(hostOf), why: "unsupported" });
        continue;
      }
      page = chosen;
    }
    if (page && /^https?:/i.test(page)) usedUrls.push(page);
    for (const u of page ? [page] : cited) {
      const t = tierOf(u, about);
      if (t >= 2) used.set(hostOf(u), Math.max(used.get(hostOf(u)) ?? 0, t) as Tier);
    }
    const body = stripCites(line.replace(BULLET, ""));
    // One clean attribution, only when the bullet rests on a specific source (research bullets).
    const attr = o.mode === "research" && page ? ` (${sourceName(page)})` : "";
    out.push(`• ${body.replace(/\.$/, "")}${attr}.`);
  }
  const rank = (s: Src, about = "") => tierOf(s.url, about);
  let passing: Src[];
  if (check && o.mode === "research") {
    // The Sources line lists exactly the pages the kept bullets rest on.
    passing = [...new Set(usedUrls)].map((u) => o.sources.find((s) => s.url === u) ?? { url: u, title: o.titles?.get(u) ?? evidenceFor(u, o).title ?? hostOf(u) });
  } else {
    passing = o.sources.filter((s) => used.has(hostOf(s.url)) || rank(s) >= 2);
    passing.sort((a, b) => Number(used.has(hostOf(b.url))) - Number(used.has(hostOf(a.url))) || rank(b) - rank(a));
  }
  // QA retest minor: a source's label is never a bare domain: its fetched page title when the citation gave none.
  const bare = (t: string, u: string) => !t || /^https?:/i.test(t) || t.toLowerCase().replace(/^www\./, "") === hostOf(u);
  passing = passing.map((s) => (bare(s.title, s.url) ? { ...s, title: evidenceFor(s.url, o).title.replace(/\s+/g, " ").trim().slice(0, 90) || s.title } : s));
  const goodUnused = [...new Set((o.read ?? []).filter((u) => tierOf(u) >= 2).map(hostOf))].filter((h) => !used.has(h));
  return { text: out.join("\n"), sources: passing, kept: out.filter((l) => l.startsWith("• ")).length, dropped, checks, goodUnused };
}

/** Every URL cited inline anywhere in the reply. */
export function lineUrls(raw: string): string[] {
  return raw.split(/\n+/).flatMap((l) => lineCites(l).urls);
}

/** The window of a page's text with the most topic words (what the no-search pass reads). */
export function bestExcerpt(text: string, words: string[], size = 1500): string {
  const t = text.replace(/\s+/g, " ");
  if (t.length <= size || !words.length) return t.slice(0, size);
  const lower = t.toLowerCase();
  let best = 0;
  let bestAt = 0;
  for (let at = 0; at < Math.min(lower.length, 150_000); at += 400) {
    const win = lower.slice(at, at + size);
    const n = words.reduce((k, w) => k + (win.split(w).length - 1), 0);
    if (n > best) {
      best = n;
      bestAt = at;
    }
  }
  return t.slice(bestAt, bestAt + size);
}

/** When nothing citable came back: say so plainly, keep the gist as labeled background (no sites). */
export function noGoodSourcesParas(
  dropped: { line: string; why?: "weak" | "unsupported" }[],
  question: string | null,
  background: string[] = [],
): string[] {
  const unsupported = dropped.length > 0 && dropped.every((d) => d.why === "unsupported");
  // QA retest (da13848): never promise background and deliver nothing. The dropped bullets' gist, else
  // general background written without any sources (concepts only, no names, numbers or studies), else no promise.
  const gist = dropped
    .slice(0, 3)
    .map((d) => `• ${stripCites(d.line.replace(BULLET, "")).replace(/\.$/, "")}.`)
    .filter((l) => l.length > 12);
  const bg = background.map((l) => l.trim()).filter((l) => /^[•*-]\s+\S/.test(l) && l.length > 12)
    // Unsourced background never carries specifics: no figures, no named people or companies, no links.
    .filter((l) => !/\d|https?:|\[|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(l.replace(/^[•*-]\s+\S+/, ""))).map((l) => `• ${l.replace(/^[•*-]\s+/, "")}`).slice(0, 4);
  const body = gist.length ? gist : bg;
  const lead = !body.length
    ? "I couldn't find sources I'd want you to cite on this one."
    : unsupported && gist.length
      ? "I couldn't match these to a page that actually backs them up, so treat this as general background, not something to cite:"
      : "I couldn't find sources I'd want you to cite on this one. What came up were summary and blog sites, so here's general background instead (not something to cite):";
  return [
    lead,
    ...body,
    "For citable examples, try Google Scholar or your library's business databases, or ask me to look for a specific leader or company.",
    ...(question ? [question] : []),
  ];
}

/** True when noGoodSourcesParas would have nothing to show under its lead (so the route writes general background). */
export function needsBackground(dropped: { line: string }[]): boolean {
  return !dropped.slice(0, 3).some((d) => stripCites(d.line.replace(BULLET, "")).length > 10);
}

const TOPIC_GENERIC = new Set(["leadership", "leader", "leaders", "example", "examples", "style", "styles", "theory", "theories", "management", "manager", "business", "company", "companies", "research", "sources", "about", "their", "which", "where", "there", "find", "other", "should", "would", "could", "practice", "approach", "approaches"]);
/** The words a page has to mention to be on topic ("real examples of servant leadership" → ["servant"]). */
export function topicTerms(topic: string): string[] {
  return [...new Set(topic.toLowerCase().split(/[^a-z-]+/).filter((w) => w.length >= 5 && !TOPIC_GENERIC.has(w)))];
}
/** Fetched pages that never mention any topic term (a generic "Leadership case studies in education 4" page on a servant-leadership ask). */
export function offTopicPages(fetched: Map<string, { title: string; text: string }>, terms: string[]): Set<string> {
  const out = new Set<string>();
  if (!terms.length) return out;
  for (const [u, f] of fetched) {
    const hay = `${f.title} ${f.text}`.toLowerCase();
    // Only judge a page we actually read (a blocked or empty fetch says nothing about it).
    if (f.text.length > 300 && !terms.some((t) => hay.includes(t.replace(/-/g, " ")) || hay.includes(t))) out.add(u);
  }
  return out;
}
