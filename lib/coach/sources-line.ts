/** PC-31: the line under a researched reply that names where it came from (site names; the links were checked server-side). */
export type SourceRef = { title: string; url: string };

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function sourcesLine(sources: SourceRef[] | undefined | null): string | null {
  const list = (sources ?? []).filter((s) => s && s.url).slice(0, 4);
  if (!list.length) return null;
  const seen = new Set<string>();
  const parts = list.map((s) => {
    const host = sourceHost(s.url);
    const raw = (s.title || "").replace(/\s+/g, " ").trim();
    // xAI citations often come back with the URL as the title: use the page's slug as its title
    // ("Servant leadership at Heritage Bible College"), else the site name, not a raw link.
    let title = !raw || /^https?:\/\//i.test(raw) || raw.toLowerCase().replace(/^www\./, "") === host.toLowerCase() ? slugTitle(s.url) ?? host : raw.slice(0, 80);
    if (seen.has(title.toLowerCase())) title = slugTitle(s.url) ?? title;
    seen.add(title.toLowerCase());
    const label = title === host ? host : host && !title.toLowerCase().includes(host.split(".")[0]!.toLowerCase()) ? `${title} (${host})` : title;
    // QA 3:46: one Sources line with linked titles (the chat renders [label](url) as a link).
    return /^https?:\/\//i.test(s.url) ? `[${label.replace(/[[\]]/g, "")}](${s.url})` : label;
  });
  return `Sources: ${parts.join(" · ")}`;
}

/** "…/article/25/7/600/264455/Servant-leadership-at-Heritage-Bible-College-a" → "Servant leadership at Heritage Bible College a". */
export function slugTitle(url: string): string | null {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const segs = path.split("/").map((x) => decodeURIComponent(x).replace(/\.(?:html?|php|aspx?|pdf)$/i, "")).filter(Boolean);
  const best = [...segs].reverse().find((x) => /[a-z]/i.test(x) && (x.match(/[-_]/g) ?? []).length >= 2 && !/^[0-9a-f-]{20,}$/i.test(x));
  if (!best) return null;
  const words = best.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (words.length < 8) return null;
  const t = words.charAt(0).toUpperCase() + words.slice(1);
  return t.length > 70 ? `${t.slice(0, 69).replace(/\s+\S*$/, "")}…` : t;
}

/** The Sources line as text and links, for the chat bubble. */
export function parseSourcesLine(line: string): ({ text: string } | { label: string; url: string })[] | null {
  if (!/^Sources:/.test(line)) return null;
  const out: ({ text: string } | { label: string; url: string })[] = [];
  const re = /\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index) });
    out.push({ label: m[1]!, url: m[2]! });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

/** The Sources line as plain words (speech, transcripts): labels without the links. */
export function sourcesLinePlain(line: string): string {
  return line.replace(/\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)\)/g, "$1");
}
