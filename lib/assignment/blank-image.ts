/**
 * Blank-page guard for photos and scanned pages, run in the browser before OCR.
 * Vision models can invent a whole "assignment" for an empty white image, so a
 * page with no ink at all is never sent: the file fails as unreadable instead.
 * Deliberately conservative: a page with even a single short word passes.
 */

/** Share of sampled pixels that differ clearly from the page background (0–1). */
export function inkRatio(rgba: ArrayLike<number>, stride = 1): number {
  const n = Math.floor(rgba.length / 4);
  if (!n) return 0;
  const hist = new Uint32Array(256);
  let sampled = 0;
  for (let i = 0; i < n; i += stride) {
    const o = i * 4;
    const a = rgba[o + 3]! / 255;
    // Composite onto white so a transparent canvas reads as paper, not as ink.
    const lum = ((rgba[o]! * 299 + rgba[o + 1]! * 587 + rgba[o + 2]! * 114) / 1000) * a + 255 * (1 - a);
    hist[Math.round(lum)]!++;
    sampled++;
  }
  // Background = most common luminance; ink = clearly darker or lighter than it.
  let bg = 0;
  for (let v = 1; v < 256; v++) if (hist[v]! > hist[bg]!) bg = v;
  let ink = 0;
  for (let v = 0; v < 256; v++) if (Math.abs(v - bg) > 48) ink += hist[v]!;
  return ink / sampled;
}

/**
 * Below this, a page has no readable marks. One short typed word on a full
 * 1600px page is ~200 ink pixels of ~2M (~0.0001), so this sits well under it.
 */
export const BLANK_INK_RATIO = 0.00002;

export function looksBlank(rgba: ArrayLike<number>): boolean {
  return inkRatio(rgba) < BLANK_INK_RATIO;
}
