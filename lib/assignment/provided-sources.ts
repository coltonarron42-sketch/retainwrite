import type { ProvidedReading, ProvidedSourceOrigin } from "@/lib/assignment/schema";

/** Normalize URL for dedupe: lowercase host, strip trailing slash. */
export function normalizeSourceUrl(raw: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProtocol);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return null;
  }
}

export function parseLinkField(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);
}

export function mergeProvidedSources(
  items: Array<{
    title?: string;
    url?: string;
    notes?: string;
    origin: ProvidedSourceOrigin;
  }>,
): ProvidedReading[] {
  const byKey = new Map<string, ProvidedReading>();

  for (const item of items) {
    const normalized = item.url ? normalizeSourceUrl(item.url) : null;
    const key = normalized || `title:${(item.title || "").toLowerCase().trim()}`;
    if (!key || key === "title:") continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        title: item.title,
        url: normalized || item.url,
        notes: item.notes,
        origin: item.origin,
      });
      continue;
    }

    // Prefer richer record (title + URL beats URL-only).
    byKey.set(key, {
      title: existing.title || item.title,
      url: existing.url || normalized || item.url,
      notes: existing.notes || item.notes,
      origin: existing.origin || item.origin,
      provenance: existing.provenance,
    });
  }

  return [...byKey.values()];
}

/** Pull http(s) URLs out of plain text. */
export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:]+$/, "")))];
}
