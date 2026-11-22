import { describe, expect, it } from "vitest";
import { inkRatio, looksBlank } from "@/lib/assignment/blank-image";

function page(w: number, h: number, fill: [number, number, number, number] = [255, 255, 255, 255]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(fill, i * 4);
  return d;
}
function ink(d: Uint8ClampedArray, w: number, x: number, y: number, bw: number, bh: number, rgb = [20, 20, 20]) {
  for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) d.set([...rgb, 255], (yy * w + xx) * 4);
}

describe("blank-page guard (never OCR an empty photo)", () => {
  const W = 1236, H = 1600;
  it("a pure white page is blank", () => {
    expect(looksBlank(page(W, H))).toBe(true);
  });
  it("a transparent canvas is paper, not ink", () => {
    expect(looksBlank(page(W, H, [0, 0, 0, 0]))).toBe(true);
  });
  it("an evenly grey or shaded-but-empty page is blank", () => {
    const d = page(W, H, [200, 196, 190, 255]);
    ink(d, W, 0, 0, W, 300, [185, 182, 178]); // soft shadow band
    expect(looksBlank(d)).toBe(true);
  });
  it("one short typed word passes", () => {
    const d = page(W, H);
    // five 2px-stroke letters, ~15px tall: ~5 × 2 strokes × 15px × 2px
    for (let k = 0; k < 5; k++) { ink(d, W, 100 + k * 12, 100, 2, 15); ink(d, W, 106 + k * 12, 100, 2, 15); }
    expect(inkRatio(d)).toBeGreaterThan(0.00002);
    expect(looksBlank(d)).toBe(false);
  });
  it("a light-on-dark page (whiteboard photo inverted) still counts its marks", () => {
    const d = page(W, H, [30, 30, 30, 255]);
    ink(d, W, 200, 200, 300, 6, [240, 240, 240]);
    expect(looksBlank(d)).toBe(false);
  });
});
