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
  const parts = list.map((s) => {
    const host = sourceHost(s.url);
    const raw = (s.title || "").replace(/\s+/g, " ").trim();
    // xAI citations often come back with the URL as the title: show the site name, not a raw link.
    const title = !raw || /^https?:\/\//i.test(raw) ? host : raw.slice(0, 80);
    const label = title === host ? host : host && !title.toLowerCase().includes(host.split(".")[0]!.toLowerCase()) ? `${title} (${host})` : title;
    // QA 3:46: one Sources line with linked titles (the chat renders [label](url) as a link).
    return /^https?:\/\//i.test(s.url) ? `[${label.replace(/[[\]]/g, "")}](${s.url})` : label;
  });
  return `Sources: ${parts.join(" · ")}`;
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
