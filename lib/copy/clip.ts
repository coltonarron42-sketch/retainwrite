/** Shorten to at most `max` characters at a word boundary, with "…" when cut. Never cuts a word. */
export function clipWords(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const atSpace = cut.lastIndexOf(" ");
  const base = (atSpace > max * 0.4 ? cut.slice(0, atSpace) : cut).replace(/[\s,;:.–-]+$/, "");
  return `${base}…`;
}
