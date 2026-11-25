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
    const title = (s.title || host).replace(/\s+/g, " ").trim().slice(0, 80);
    return host && !title.toLowerCase().includes(host.split(".")[0]!.toLowerCase()) ? `${title} (${host})` : title;
  });
  return `Sources: ${parts.join(" · ")}`;
}
