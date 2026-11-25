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

/** skip: this line is the bubble's text after its first `skip` paragraphs (a bubble that kept its opening and moved on to a new ask). */
type Rec = { who: PastLine["who"]; text: string; el: Element | null; at?: number; gone?: number; quiet?: boolean; skip?: number; born?: number; flash?: boolean };

const paras = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
/** Checklist ticks don't make a paragraph a different one. */
const pkey = (p: string) => p.replace(/[✓○]/g, "").replace(/\s+/g, " ").trim();
const viewOf = (text: string, skip = 0) => (skip ? paras(text).slice(skip).join("\n") : text);

/**
 * QA 11:08 (merged entries): how a bubble's new text relates to its line, paragraph by paragraph.
 * grow: the same turn (it typed in further, a box ticked, it shrank back while typing).
 * k: leading paragraphs in common; k > 0 without grow means the bubble kept its opening and moved
 * on to a new ask, so the new paragraphs are a new line (never merged into the old one).
 */
export function relate(old: string, next: string): { grow: boolean; k: number; shrink?: boolean } {
  const a = paras(old), b = paras(next);
  let k = 0;
  while (k < a.length && k < b.length && pkey(a[k]!) === pkey(b[k]!)) k++;
  if (k === a.length) return { grow: true, k };
  // Fewer paragraphs, or the last one cut back: the same turn, but the line keeps what was shown.
  if (k === b.length) return { grow: true, k, shrink: true };
  if (k === a.length - 1 && pkey(b[k]!).startsWith(pkey(a[k]!).slice(0, Math.max(1, pkey(a[k]!).length - 1)))) return { grow: true, k };
  if (k === b.length - 1 && pkey(a[k]!).startsWith(pkey(b[k]!))) return { grow: true, k, shrink: true };
  return { grow: false, k };
}

const flat = (t: string) => pkey(t).replace(/\s+/g, " ").trim();
/** next is old's closing words (old had a lead-in before them). */
export function isTail(old: string, next: string): boolean {
  const o = flat(old), n = flat(next);
  return n.length >= 20 && o.length > n.length && o.endsWith(n);
}

/** Text that is still typing in (or a flash replaced within this long) stays the same line. */
const SETTLE_MS = 1200;
/** A bubble swapped for an identical one this quickly is a re-render, not a new turn. */
const REMOUNT_MS = 2000;
/** QA 11:21/11:26: a Pau bubble gone again this fast, never coming back, was an in-between render (a plan that re-shaped while data loaded), not a turn. */
const FLASH_MS = 2500;

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
  for (const r of recs) {
    if (!r.el || isAttached(r.el) || r.gone !== undefined) continue;
    r.gone = now;
    if (r.who === "pau" && !r.quiet && r.born !== undefined && now - r.born < FLASH_MS) {
      r.flash = true;
      changed = true;
    }
  }
  // Pass 1: bubbles already recorded. They update in place, or let go of their line when reused for a new turn.
  const fresh: typeof onScreen = [];
  for (const s of onScreen) {
    if (!s.text) continue;
    const mine = recs.find((r) => r.el === s.el);
    if (!mine) {
      fresh.push(s);
      continue;
    }
    const view = viewOf(s.text, mine.skip);
    if (mine.text === view) continue;
    const rel = relate(mine.text, view);
    if (rel.shrink && !mine.quiet) continue;
    // QA 11:26: once the student has replied after this line, it has settled: a new ask in the same bubble is a new line.
    const answered = recs.slice(recs.indexOf(mine) + 1).some((r) => !r.quiet && r.who !== mine.who);
    // A lead-in that lands above the ask ("Awesome, …" then the same question): still that turn.
    // QA 11:56: a line still in its first moments (no reply yet) that re-shapes is one turn, never split into opening + ask.
    const young = !answered && mine.born !== undefined && now - mine.born < FLASH_MS;
    if (mine.quiet ? restoring : rel.grow || isTail(view, mine.text) || young || (!answered && now - (mine.at ?? 0) < SETTLE_MS)) {
      mine.text = view;
      mine.at = now;
      if (!mine.quiet) changed = true;
      // A flash that settles back into the line before it (same bubble, same words): that line, not a second one.
      const k = recs.indexOf(mine);
      const prev = recs.slice(0, k).reverse().find((r) => !r.quiet);
      if (!mine.quiet && prev && prev.who === mine.who && prev.text === mine.text && (!prev.el || !isAttached(prev.el))) {
        prev.el = mine.el;
        prev.gone = undefined; prev.flash = undefined;
        recs.splice(k, 1);
      }
      continue;
    }
    mine.el = null;
    mine.gone = now;
    if (!mine.quiet && rel.k > 0) {
      // Kept its opening (the checklist), moved on to a new ask: only the new ask is a new line.
      recs.push({ who: s.who, text: paras(view).slice(rel.k).join("\n"), el: s.el, at: now, born: now, skip: (mine.skip ?? 0) + rel.k });
      changed = true;
      continue;
    }
    fresh.push(s);
  }
  // Pass 2, in screen order: bubbles that are new, or reused for a new turn.
  for (const s of fresh) {
    const gone = (r: Rec) => !r.el || !isAttached(r.el);
    const last = [...recs].reverse().find((r) => !r.quiet);
    const recent = (r: Rec) => r.gone !== undefined && now - r.gone < REMOUNT_MS;
    // The line's words, drawn whole or still under the opening it was recorded under.
    const same = (r: Rec) => s.text === r.text || (Boolean(r.skip) && viewOf(s.text, r.skip) === r.text);
    const again =
      // The newest line drawn again after its bubble went away (however long that took): the same turn.
      // Two identical bubbles on screen together stay two replies.
      (last && last.who === s.who && same(last) && gone(last) ? last : undefined) ??
      recs.find((r) => r.who === s.who && same(r) && gone(r) && (r.gone === undefined || recent(r))) ??
      // Swapped for a fresh bubble that also moved on a little (a checklist ticked as it remounted): still that turn.
      [...recs].reverse().find((r) => r.who === s.who && gone(r) && recent(r) && !r.skip && relate(r.text, s.text).grow) ??
      // QA 11:26: redrawn without its lead-in ("Last one before the stance interview.", a lead line): the same turn, the line keeps what was shown.
      [...recs].reverse().find((r) => r.who === s.who && gone(r) && recent(r) && !r.quiet && !r.skip && (isTail(r.text, s.text) || isTail(s.text, r.text)));
    if (!again) {
      // Swapped for a fresh bubble that keeps the opening of a line that just left and adds a new ask:
      // the new ask is its own line.
      const opener = [...recs].reverse().find((r) => r.who === s.who && gone(r) && recent(r) && !r.quiet && !r.skip && relate(r.text, s.text).k > 0);
      // QA 11:56: the line it would split from was itself only just drawn, with no reply since: an in-between render this replaces whole.
      const youngOpener = opener && opener.born !== undefined && now - opener.born < FLASH_MS && !recs.slice(recs.indexOf(opener) + 1).some((r) => !r.quiet && r.who !== opener.who);
      if (opener && youngOpener) {
        opener.text = s.text;
        opener.el = s.el;
        opener.at = now;
        opener.gone = undefined; opener.flash = undefined;
        if (!opener.quiet) changed = true;
        continue;
      }
      if (opener) {
        const k = relate(opener.text, s.text).k;
        const rest = paras(s.text).slice(k).join("\n");
        const dup = recs.find((r) => r.who === s.who && r.text === rest && gone(r) && recent(r));
        if (dup) {
          dup.el = s.el;
          dup.skip = k;
          dup.gone = undefined; dup.flash = undefined;
        } else {
          recs.push({ who: s.who, text: rest, el: s.el, at: now, born: now, skip: k, quiet: restoring || undefined });
          if (!restoring) changed = true;
        }
        continue;
      }
    }
    if (again) {
      if (again.skip && s.text === again.text) again.skip = 0;
      const view = viewOf(s.text, again.skip);
      if (again.text !== view && !relate(again.text, view).shrink) {
        again.text = view;
        again.at = now;
        if (!again.quiet) changed = true;
      }
      again.el = s.el;
      again.gone = undefined; again.flash = undefined;
      continue;
    }
    recs.push({ who: s.who, text: s.text, el: s.el, at: now, born: now, quiet: restoring || undefined });
    if (!restoring) changed = true;
  }
  return changed;
}

/** What Past chat shows: every line that was a real turn on screen. */
export function linesOf(recs: Rec[]): PastLine[] {
  const live = recs.filter((r) => !r.quiet);
  // A flash is dropped only when Pau moved straight on (no reply from the student came next): a question they answered quickly stays.
  return live.filter((r, i) => !r.flash || live.slice(i + 1).find((x) => !x.flash)?.who === "you").map(({ who, text }) => ({ who, text }));
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
    // The screen redraws its history after a reload (some of it only once the brief loads):
    // that's not new turns. It ends at the student's first key or tap, or after 20 s.
    restoreUntil.current = Date.now() + 20000;
    const end = (e: Event) => {
      // Opening Past chat or the skeleton is reading, not a new turn.
      if ((e.target as Element | null)?.closest?.("[data-past-chat], [data-past-chat-open], [data-skeleton-panel], [data-skeleton-open], [data-show-answers], [data-chat-reveal]")) return;
      restoreUntil.current = 0;
      document.removeEventListener("keydown", end, true);
      document.removeEventListener("pointerdown", end, true);
    };
    document.addEventListener("keydown", end, true);
    document.addEventListener("pointerdown", end, true);
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
    // "Show my answers" (and anything marked data-chat-reveal) redraws earlier turns: not new ones.
    const reveal = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-show-answers], [data-chat-reveal]")) restoreUntil.current = Date.now() + 3000;
    };
    document.addEventListener("pointerdown", reveal, true);
    document.addEventListener("click", reveal, true);
    scan();
    return () => {
      document.removeEventListener("pointerdown", reveal, true);
      document.removeEventListener("click", reveal, true);
      mo.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [opts.enabled]);
  return lines;
}
