/**
 * A tall photo is read as two overlapping halves (top 0-55%, bottom 45-100%)
 * in parallel: each half is sharper and the model writes half as much, so it
 * is faster and skips less. This joins the two transcriptions, dropping the
 * lines that both halves read in the overlap.
 */

function norm(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function same(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 10 || y.length < 10) return false;
  return x === y || (x.length >= 20 && y.includes(x)) || (y.length >= 20 && x.includes(y));
}

export function mergeTileTexts(top: string, bottom: string): string {
  const a = top.trim().split("\n");
  const b = bottom.trim().split("\n");
  if (!a.join("").trim()) return bottom.trim();
  if (!b.join("").trim()) return top.trim();
  const tailStart = Math.max(0, a.length - 20);
  for (let i = 0; i < Math.min(b.length, 12); i++) {
    for (let t = tailStart; t < a.length; t++) {
      if (same(a[t]!, b[i]!)) return [...a.slice(0, t), ...b.slice(i)].join("\n").trim();
    }
  }
  return `${top.trim()}\n${bottom.trim()}`;
}
