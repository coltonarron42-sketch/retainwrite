"use client";

import { useEffect, useRef, useState } from "react";
import type { PastLine } from "@/components/stages/focus-panels";

/**
 * Round 4 #3: Past chat is a recording of the turns as they render, never a reconstruction.
 * Every chat bubble carries data-chat-line="pau" | "you" | "pick". A MutationObserver records
 * each bubble the first time it shows (in screen order), keeps its text current while it is on
 * screen (a checklist ticking ✓, a reply finishing), and never merges two bubbles into one line.
 * A bubble that re-renders after being replaced (reload, edit, "Show my answers") maps back to
 * its earlier line instead of being added again. Welcome lines and panels are skipped.
 */
const SKIP = "[data-chat-skip], [data-past-chat], [data-skeleton-panel], [data-welcome-back], [data-stage-chat]";

export function chatLineText(el: Element): string {
  const own = el.getAttribute("data-chat-text");
  if (own !== null) return own.trim();
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button, [aria-hidden='true'], .sr-only, [data-chat-name], [data-chat-line], textarea, input, [role='status']").forEach((x) => {
    // A nested bubble records itself; buttons and screen-reader labels aren't what was said.
    x.remove();
  });
  // A detached clone has no layout, so innerText would run paragraphs together: break after each block by hand.
  clone.querySelectorAll("p, li, div, h1, h2, h3, h4, br").forEach((x) => x.after(clone.ownerDocument.createTextNode("\n")));
  return (clone.textContent ?? "").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

type Rec = { who: PastLine["who"]; text: string; el: Element | null; at?: number; gone?: number; quiet?: boolean };

/** Text that is still typing in (or a flash replaced within this long) stays the same line. */
const SETTLE_MS = 1200;
/** A bubble swapped for an identical one this quickly is a re-render, not a new turn. */
const REMOUNT_MS = 2000;

/** Still the same turn: it typed in further, or it opens the same way (a checklist ticking, a chip filling in). */
export function sameTurn(a: string, b: string): boolean {
  if (b.startsWith(a.slice(0, Math.max(1, a.length - 1))) || a.startsWith(b)) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= Math.min(40, Math.ceil(0.6 * Math.min(a.length, b.length)));
}

/**
 * Pure core (testable): fold the bubbles now on screen into the recording, in the order they appear.
 * - A bubble that keeps typing in stays one line; a bubble reused for a new turn starts a new line.
 * - The same words remounting at once (a re-render) are the same line; the same words sent again later are a new line.
 * - restoring: right after a reload, history the screen re-renders is not a new turn (quiet).
 */
export function foldLines(
  recs: Rec[],
  onScreen: { el: Element; who: PastLine["who"]; text: string }[],
  isAttached: (el: Element) => boolean,
  now = 0,
  restoring = false,
): boolean {
  let changed = false;
  for (const r of recs) if (r.el && !isAttached(r.el) && r.gone === undefined) r.gone = now;
  for (const s of onScreen) {
    if (!s.text) continue;
    const mine = recs.find((r) => r.el === s.el);
    if (mine) {
      if (mine.text === s.text) continue;
      const grow = sameTurn(mine.text, s.text);
      if (mine.quiet ? restoring : grow || now - (mine.at ?? 0) < SETTLE_MS) {
        mine.text = s.text;
        mine.at = now;
        if (!mine.quiet) changed = true;
        continue;
      }
      mine.el = null;
      mine.gone = now;
      recs.push({ who: s.who, text: s.text, el: s.el, at: now });
      changed = true;
      continue;
    }
    const again = recs.find(
      (r) => r.who === s.who && r.text === s.text && (!r.el || !isAttached(r.el)) && (r.gone === undefined || now - r.gone < REMOUNT_MS),
    );
    if (again) {
      again.el = s.el;
      again.gone = undefined;
      continue;
    }
    recs.push({ who: s.who, text: s.text, el: s.el, at: now, quiet: restoring || undefined });
    if (!restoring) changed = true;
  }
  return changed;
}

/** What Past chat shows: every line that was a real turn on screen. */
export function linesOf(recs: Rec[]): PastLine[] {
  return recs.filter((r) => !r.quiet).map(({ who, text }) => ({ who, text }));
}

/** Saved lines first; a bubble already on screen that matches one maps onto it; the rest is re-rendered history (quiet). */
export function seedLines(saved: PastLine[], current: Rec[]): Rec[] {
  const out: Rec[] = saved.map((l) => ({ who: l.who, text: l.text, el: null }));
  for (const r of current) {
    const hit = out.find((x) => !x.el && x.who === r.who && x.text === r.text);
    if (hit) hit.el = r.el;
    else out.push({ ...r, quiet: true });
  }
  return out;
}

export function useTurnRecorder(opts: { enabled: boolean; saved: PastLine[]; onChange?: (lines: PastLine[]) => void }): PastLine[] {
  const recs = useRef<Rec[]>([]);
  const seeded = useRef(false);
  const restoreUntil = useRef(0);
  const [lines, setLines] = useState<PastLine[]>([]);
  const onChange = useRef(opts.onChange);
  useEffect(() => {
    onChange.current = opts.onChange;
  });
  // Lines saved on an earlier visit come first; this visit's bubbles map onto them or follow.
  useEffect(() => {
    if (seeded.current || !opts.saved.length) return;
    seeded.current = true;
    recs.current = seedLines(opts.saved, recs.current);
    restoreUntil.current = Date.now() + 2500;
    setLines(linesOf(recs.current));
  }, [opts.saved]);
  useEffect(() => {
    if (!opts.enabled || typeof document === "undefined") return;
    let raf = 0;
    const scan = () => {
      raf = 0;
      const onScreen = [...document.querySelectorAll("[data-chat-line]")]
        .filter((el) => !el.closest(SKIP) && !el.parentElement?.closest("[data-chat-line]"))
        .map((el) => ({ el, who: (el.getAttribute("data-chat-line") as PastLine["who"]) || "pau", text: chatLineText(el) }));
      const now = Date.now();
      if (foldLines(recs.current, onScreen, (el) => el.isConnected, now, now < restoreUntil.current)) {
        const next = linesOf(recs.current);
        setLines(next);
        onChange.current?.(next);
      }
    };
    const mo = new MutationObserver(() => {
      if (!raf) raf = window.requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan();
    return () => {
      mo.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [opts.enabled]);
  return lines;
}
