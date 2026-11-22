"use client";

import { speakableSentences } from "@/lib/voice/speakable";

/**
 * One shared read-aloud queue for Pau Pau's own words (browser speechSynthesis).
 * Sentences are queued separately (Chrome cuts long utterances) and read one
 * at a time, in order.
 *
 * Mobile (PLAN.md 9 voice): iOS Safari and Chrome Android only start speech
 * that is "unlocked" by a user gesture, load voices late, sometimes never
 * fire onend, drop a speak() that follows cancel() in the same tick, and can
 * leave the engine paused. So: unlock on the first tap (and on the Voice
 * switch), hold the queue until then, wait for voices, give every utterance a
 * watchdog, wait a beat after cancel(), and resume() before each speak().
 */

let queue: string[] = [];
let active = false;
let generation = 0;
const listeners = new Set<() => void>();
let speakingNow = false;
let unlocked = false;
let lastCancelAt = 0;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let cachedVoice: SpeechSynthesisVoice | null | undefined;

function setSpeaking(v: boolean) {
  if (speakingNow === v) return;
  speakingNow = v;
  listeners.forEach((l) => l());
}

/* The sentence the browser is actually saying right now: set from the
   utterance's own start event, cleared on its end/error and on stop. Drives
   Pau Pau's speaking waves (never shown when nothing is audible). */
let audible: string | null = null;
const audibleListeners = new Set<() => void>();
function setAudible(text: string | null) {
  if (audible === text) return;
  audible = text;
  audibleListeners.forEach((l) => l());
}
export function subscribeAudible(listener: () => void) {
  audibleListeners.add(listener);
  return () => audibleListeners.delete(listener);
}
/** True when the last silence is a real stop (Stop reading, barge-in, last
    sentence done), not the gap between two sentences: the waves fade at once. */
let audibleEnded = true;
export function audibleEndedForGood(): boolean {
  return audibleEnded;
}
export function audibleSentence(): string | null {
  return audible;
}

export function subscribeSpeaking(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function isSpeaking() {
  return speakingNow;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const synth = (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  return (
    Boolean(synth) &&
    typeof synth?.speak === "function" &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

const PREFERRED = /(natural|neural|google us english|samantha|aria|jenny|ava|allison|serena|karen|daniel)/i;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return null; // not loaded yet: try again next time
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const us = en.filter((v) => /^en[-_]us$/i.test(v.lang));
  cachedVoice =
    us.find((v) => PREFERRED.test(v.name)) ??
    en.find((v) => PREFERRED.test(v.name)) ??
    us.find((v) => v.localService) ??
    us[0] ??
    en[0] ??
    null;
  return cachedVoice;
}

/** Has this page had a real tap/click/key yet (needed by mobile browsers)? */
function gestureSeen(): boolean {
  if (unlocked) return true;
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } });
  // Browsers without the User Activation API: try, and let the watchdog move on if it's blocked.
  if (!nav?.userActivation) return true;
  return Boolean(nav.userActivation.hasBeenActive);
}

let interacted = false;
/** A real tap/click/key on this page load (not a reload's restored screen). */
function interactedThisLoad(): boolean {
  if (interacted) return true;
  if (typeof window === "undefined") return true; // unit tests / server
  const nav = navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } };
  return Boolean(nav.userActivation?.hasBeenActive);
}
/** Called from the gesture listeners (and the Voice toggle, itself a tap). */
export function noteInteraction() {
  interacted = true;
}

let installed = false;
/** Listens once for the first tap or key and for late-loading voices. */
export function installSpeechUnlock() {
  if (installed || typeof window === "undefined" || typeof window.addEventListener !== "function" || !speechSupported()) return;
  installed = true;
  const onGesture = () => {
    interacted = true;
    unlockSpeech();
  };
  for (const type of ["pointerdown", "touchend", "keydown", "click"] as const) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
  const synth = window.speechSynthesis as SpeechSynthesis & { onvoiceschanged?: unknown };
  const onVoices = () => {
    cachedVoice = undefined;
    pickVoice();
  };
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", onVoices);
  else synth.onvoiceschanged = onVoices;
  // Chrome Android sometimes leaves the engine paused after the tab was hidden.
  document?.addEventListener?.("visibilitychange", () => {
    if (document.visibilityState === "visible" && (queue.length || active)) {
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    }
  });
}

/**
 * Call inside a user gesture (the Voice switch, Send, any tap). Speaks a
 * silent utterance once so iOS/Android allow speech that starts later, after
 * a network reply, then plays anything that was waiting.
 */
export function unlockSpeech() {
  interacted = true;
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  try {
    synth.resume();
  } catch {
    /* ignore */
  }
  if (!unlocked) {
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 10;
      synth.speak(u);
    } catch {
      /* ignore */
    }
  }
  if (queue.length && !active) pump();
}

/** Rough upper bound for one sentence, so a missing onend can't stall the queue. */
export function utteranceBudgetMs(text: string): number {
  return 4000 + text.length * 90;
}

/** Long sentences are split at commas/semicolons (Chrome stops mid-utterance after ~15s). */
export function chunkSentence(text: string, max = 180): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const part of text.split(/(?<=[,;:—])\s+/)) {
    if ((cur + " " + part).trim().length > max && cur) {
      out.push(cur.trim());
      cur = part;
    } else cur = `${cur} ${part}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.flatMap((c) => (c.length > max * 1.5 ? c.match(new RegExp(`.{1,${max}}(\\s|$)`, "g"))!.map((x) => x.trim()) : [c]));
}

function pump() {
  if (active) return;
  if (!queue.length) {
    setSpeaking(false);
    return;
  }
  // Mobile: nothing can play before the first tap; keep the queue until then.
  if (!gestureSeen()) return;
  const wait = 80 - (Date.now() - lastCancelAt);
  if (wait > 0) {
    // speak() right after cancel() is dropped on Chrome; wait a beat.
    active = true;
    const gen = generation;
    setTimeout(() => {
      if (gen !== generation) return;
      active = false;
      pump();
    }, wait);
    return;
  }
  const next = queue.shift()!;
  active = true;
  const gen = generation;
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(next);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = 1;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
    if (gen !== generation) return;
    audibleEnded = queue.length === 0;
    setAudible(null);
    active = false;
    pump();
  };
  u.onstart = () => {
    if (gen === generation && !finished) {
      audibleEnded = false;
      setAudible(next);
    }
  };
  u.onend = done;
  u.onerror = done;
  setSpeaking(true);
  try {
    if (synth.paused) synth.resume();
  } catch {
    /* ignore */
  }
  try {
    synth.speak(u);
  } catch {
    done();
    return;
  }
  watchdog = setTimeout(done, utteranceBudgetMs(next));
}

/** Queue Pau Pau's words. `interrupt` replaces anything already playing. */
export function speak(texts: string[], opts: { interrupt?: boolean } = {}) {
  if (!speechSupported()) return;
  installSpeechUnlock();
  if (opts.interrupt) stopSpeech();
  for (const t of texts) for (const s of speakableSentences(t)) queue.push(...chunkSentence(s));
  if (queue.length) setSpeaking(true);
  pump();
  // Held for a tap: not "speaking" yet, so the mic is not paused for nothing.
  if (!active) setSpeaking(false);
}

export function stopSpeech() {
  generation++;
  queue = [];
  active = false;
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
  setSpeaking(false);
  audibleEnded = true;
  setAudible(null);
  if (speechSupported()) {
    lastCancelAt = Date.now();
    window.speechSynthesis.cancel();
  }
}

/* ---- which bubbles were already on screen / already read (per paper) ---- */

const seen = new Map<string, Set<string>>();
let latestTurn: string[] = [];

export type SpeakItem = { key: string; text: string; turn?: boolean };

/**
 * Returns the items that are new since the last call for this scope. The first
 * call for a scope (page load / reload) marks everything present as seen, so
 * only bubbles that arrive afterwards are read.
 */
export function takeNew(scope: string, items: SpeakItem[]): SpeakItem[] {
  const turn = items.filter((i) => i.turn).map((i) => i.text);
  if (turn.length) latestTurn = turn;
  let set = seen.get(scope);
  // Until the student taps or types on this page load, everything on screen is
  // restored history (a reload can swap screens and redraw old bubbles), so
  // nothing is read aloud and nothing is queued to play on the first tap.
  if (!interactedThisLoad()) {
    if (!set) seen.set(scope, (set = new Set()));
    items.forEach((i) => set!.add(i.key));
    return [];
  }
  if (!set) {
    set = new Set(items.map((i) => i.key));
    seen.set(scope, set);
    return [];
  }
  const fresh = items.filter((i) => !set.has(i.key));
  fresh.forEach((i) => set.add(i.key));
  return fresh;
}

/** Pau Pau's current turn, for "read it now" when voice is switched on. */
export function currentTurn(): string[] {
  return latestTurn;
}

/** Test helper. */
export function __resetSpeech() {
  seen.clear();
  interacted = false;
  latestTurn = [];
  queue = [];
  active = false;
  unlocked = false;
  lastCancelAt = 0;
  cachedVoice = undefined;
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

/** Test helper: pretend the student already tapped. */
export function __unlockForTest() {
  unlocked = true;
}
