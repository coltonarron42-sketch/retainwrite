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
  return (clone.innerText ?? clone.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

type Rec = { who: PastLine["who"]; text: string; el: Element | null };

/** Pure core (testable): fold the bubbles now on screen into the recording. */
export function foldLines(recs: Rec[], onScreen: { el: Element; who: PastLine["who"]; text: string }[], isAttached: (el: Element) => boolean): boolean {
  let changed = false;
  for (const s of onScreen) {
    if (!s.text) continue;
    const mine = recs.find((r) => r.el === s.el);
    if (mine) {
      if (mine.text !== s.text) {
        mine.text = s.text;
        changed = true;
      }
      continue;
    }
    // The same words from a bubble that's gone (a reload, an edit, a re-render): that's this line.
    const again = recs.find((r) => r.who === s.who && r.text === s.text && (!r.el || !isAttached(r.el)));
    if (again) {
      again.el = s.el;
      continue;
    }
    recs.push({ who: s.who, text: s.text, el: s.el });
    changed = true;
  }
  return changed;
}

/** Saved lines first; a bubble already recorded this visit that matches one of them maps onto it. */
export function seedLines(saved: PastLine[], current: Rec[]): Rec[] {
  const out: Rec[] = saved.map((l) => ({ who: l.who, text: l.text, el: null }));
  for (const r of current) {
    const hit = out.find((x) => !x.el && x.who === r.who && x.text === r.text);
    if (hit) hit.el = r.el;
    else out.push(r);
  }
  return out;
}

export function useTurnRecorder(opts: { enabled: boolean; saved: PastLine[]; onChange?: (lines: PastLine[]) => void }): PastLine[] {
  const recs = useRef<Rec[]>([]);
  const seeded = useRef(false);
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
    setLines(recs.current.map(({ who, text }) => ({ who, text })));
  }, [opts.saved]);
  useEffect(() => {
    if (!opts.enabled || typeof document === "undefined") return;
    let raf = 0;
    const scan = () => {
      raf = 0;
      const onScreen = [...document.querySelectorAll("[data-chat-line]")]
        .filter((el) => !el.closest(SKIP) && !el.parentElement?.closest("[data-chat-line]"))
        .map((el) => ({ el, who: (el.getAttribute("data-chat-line") as PastLine["who"]) || "pau", text: chatLineText(el) }));
      if (foldLines(recs.current, onScreen, (el) => el.isConnected)) {
        const next = recs.current.map(({ who, text }) => ({ who, text }));
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
