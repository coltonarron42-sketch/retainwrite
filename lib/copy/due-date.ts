/**
 * Due dates read back with a year: "Dec 3" → "Dec 3, 2026" (the next time
 * that date comes around, counting today). Dates that already have a year, or
 * that aren't a plain month + day, are left as written.
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function nextYearFor(month: number, day: number, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYear = new Date(now.getFullYear(), month, day);
  return thisYear >= today ? now.getFullYear() : now.getFullYear() + 1;
}

export function withYear(raw: string | null | undefined, now: Date = new Date()): string | null {
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/\b(19|20)\d{2}\b/.test(text)) return text;
  // "Dec 3", "December 3rd", "Thursday, Dec 3"
  const m = text.match(/^((?:[A-Za-z]+day,?\s+)?)([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(.*)$/);
  if (m) {
    const month = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
    const day = Number(m[3]);
    if (month >= 0 && day >= 1 && day <= 31 && !m[4]!.trim()) {
      const name = m[2]!.length > 3 && !/\.$/.test(m[2]!) ? m[2]! : m[2]!.slice(0, 1).toUpperCase() + m[2]!.slice(1, 3).toLowerCase();
      return `${m[1]}${name.charAt(0).toUpperCase()}${name.slice(1)} ${day}, ${nextYearFor(month, day, now)}`;
    }
    return text;
  }
  // "12/3" (US month/day)
  const n = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (n) {
    const month = Number(n[1]) - 1;
    const day = Number(n[2]);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      const label = new Date(2000, month, 1).toLocaleString("en-US", { month: "short" });
      return `${label} ${day}, ${nextYearFor(month, day, now)}`;
    }
  }
  return text;
}
