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
    if (title === host) return host;
    return host && !title.toLowerCase().includes(host.split(".")[0]!.toLowerCase()) ? `${title} (${host})` : title;
  });
  return `Sources: ${parts.join(" · ")}`;
}
