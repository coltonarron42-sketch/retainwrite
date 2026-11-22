"use client";

import { speakableSentences } from "@/lib/voice/speakable";

/**
 * One shared read-aloud queue for Pau Pau's bubbles (browser speechSynthesis).
 * Sentences are queued separately (Chrome cuts long utterances) and read one
 * at a time, in order.
 */

let queue: string[] = [];
let active = false;
let generation = 0;
const listeners = new Set<() => void>();
let speakingNow = false;

function setSpeaking(v: boolean) {
  if (speakingNow === v) return;
  speakingNow = v;
  listeners.forEach((l) => l());
}

export function subscribeSpeaking(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function isSpeaking() {
  return speakingNow;
}

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

const PREFERRED = /(natural|neural|google us english|samantha|aria|jenny|ava|allison|serena|karen|daniel)/i;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const us = en.filter((v) => /^en[-_]us$/i.test(v.lang));
  return (
    us.find((v) => PREFERRED.test(v.name)) ??
    en.find((v) => PREFERRED.test(v.name)) ??
    us.find((v) => v.localService) ??
    us[0] ??
    en[0] ??
    null
  );
}

function pump() {
  if (active) return;
  const next = queue.shift();
  if (!next) {
    setSpeaking(false);
    return;
  }
  active = true;
  const gen = generation;
  const u = new SpeechSynthesisUtterance(next);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = 1;
  const done = () => {
    if (gen !== generation) return;
    active = false;
    pump();
  };
  u.onend = done;
  u.onerror = done;
  setSpeaking(true);
  window.speechSynthesis.speak(u);
}

/** Queue Pau Pau's words. `interrupt` replaces anything already playing. */
export function speak(texts: string[], opts: { interrupt?: boolean } = {}) {
  if (!speechSupported()) return;
  if (opts.interrupt) stopSpeech();
  for (const t of texts) queue.push(...speakableSentences(t));
  pump();
}

export function stopSpeech() {
  generation++;
  queue = [];
  active = false;
  setSpeaking(false);
  if (speechSupported()) window.speechSynthesis.cancel();
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
  latestTurn = [];
  queue = [];
  active = false;
}
