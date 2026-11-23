"use client";

import { localUser, readScoped, writeScoped } from "@/lib/local/user-scope";
import { speakableSentences } from "@/lib/voice/speakable";
import { WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";

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
 *
 * Server voice first (PLAN.md 9, Nov 22): each sentence is fetched as MP3 from
 * /api/voice/tts (xAI text to speech) and played through one shared <audio>
 * element that is unlocked on the first tap. Web Speech is the fallback (no
 * server voice, a failed clip). "Audible" (waves, "Pau Pau is talking") is set
 * only from real playback events ('playing' / onstart), never from a timer;
 * if playback can't start, `needsTap()` turns on and the UI shows "Tap to
 * hear Pau Pau".
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

/* Audio could not start (autoplay blocked, silent engine): ask for a tap. */
let tapNeeded = false;
const tapListeners = new Set<() => void>();
function setTapNeeded(v: boolean) {
  if (tapNeeded === v) return;
  tapNeeded = v;
  tapListeners.forEach((l) => l());
}
export function subscribeNeedsTap(listener: () => void) {
  tapListeners.add(listener);
  return () => tapListeners.delete(listener);
}
export function needsTap(): boolean {
  return tapNeeded;
}

/* ---- server voice: <audio> + /api/voice/tts ---- */
let serverVoice: "unknown" | "on" | "off" = "unknown";
let serverFailures = 0;
let audioEl: HTMLAudioElement | null = null;
const clips = new Map<string, Promise<string | null>>();
/**
 * Silence at each end of a clip (seconds). xAI clips carry ~150 ms of lead and
 * 170-420 ms of tail silence; played back to back that is a 0.3-0.6 s hole
 * between clips (QA 7:21 PM "chunked"). We skip most of it.
 */
export type ClipTrim = { lead: number; end: number };
const trims = new Map<string, ClipTrim>();
/** Natural breath kept at a seam: a little before the words, a little after. */
export const KEEP_LEAD_S = 0.03;
export const KEEP_TAIL_S = 0.08;
/** Where the words start and end, in seconds, keeping a short breath at each side. */
export function silenceTrim(samples: Float32Array, sampleRate: number, floor = 0.01): ClipTrim | null {
  let lead = 0;
  while (lead < samples.length && Math.abs(samples[lead]!) < floor) lead++;
  if (lead >= samples.length) return null;
  let tail = samples.length - 1;
  while (tail > lead && Math.abs(samples[tail]!) < floor) tail--;
  return { lead: Math.max(0, lead / sampleRate - KEEP_LEAD_S), end: Math.min(samples.length / sampleRate, tail / sampleRate + KEEP_TAIL_S) };
}
async function measureTrim(url: string, blob: Blob) {
  try {
    const Ctx = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
    if (!Ctx || typeof blob.arrayBuffer !== "function") return;
    const audio = await new Ctx(1, 1, 24000).decodeAudioData(await blob.arrayBuffer());
    const t = silenceTrim(audio.getChannelData(0), audio.sampleRate);
    if (t) trims.set(url, t);
  } catch {
    /* no trim: the clip plays whole */
  }
}
// 0.05s of silence, played inside the first tap so later play() calls are allowed (iOS).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function audioSupported(): boolean {
  return typeof window !== "undefined" && typeof window.Audio === "function" && typeof fetch === "function" && typeof URL?.createObjectURL === "function";
}
function getAudio(): HTMLAudioElement | null {
  if (!audioSupported()) return null;
  if (!audioEl) {
    audioEl = new window.Audio();
    audioEl.preload = "auto";
    audioEl.setAttribute("playsinline", "");
    audioEl.setAttribute("data-pau-audio", "");
  }
  return audioEl;
}
/** Safari 17+: play through the speaker (not the earpiece) even after the mic was used, and past the silent switch. */
function preferPlaybackRoute() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type?: string } };
    if (nav.audioSession && nav.audioSession.type !== "playback") nav.audioSession.type = "playback";
  } catch {
    /* ignore */
  }
}
function fetchClip(text: string): Promise<string | null> {
  if (serverVoice === "off") return Promise.resolve(null);
  const hit = clips.get(text);
  if (hit) return hit;
  const p = fetch("/api/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 600) }),
  })
    .then(async (res) => {
      if (res.status === 503 || res.status === 401 || res.status === 404) {
        serverVoice = "off";
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (!blob.size) throw new Error("empty");
      serverVoice = "on";
      serverFailures = 0;
      const url = URL.createObjectURL(blob);
      // Measure its silence first (a few ms; never more than 150 ms), so the
      // seam is trimmed from the first play.
      await Promise.race([measureTrim(url, blob), new Promise((r) => setTimeout(r, 150))]);
      return url;
    })
    .catch(() => {
      if (++serverFailures >= 3) serverVoice = "off";
      clips.delete(text);
      return null;
    });
  clips.set(text, p);
  if (clips.size > 40) {
    const first = clips.keys().next().value;
    if (first !== undefined && first !== text) clips.delete(first);
  }
  return p;
}
/** Which engine reads Pau Pau's words right now (for tests and the report). */
export function voiceEngine(): "server" | "browser" | "unknown" {
  return serverVoice === "on" ? "server" : serverVoice === "off" ? "browser" : "unknown";
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
  if (audioSupported() && serverVoice !== "off") return true;
  return synthSupported();
}
function synthSupported(): boolean {
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


/** A real student action (tests and callers that know one happened). */
export function noteInteraction() {
  armSpeech();
}

/*
 * ---- the restore barrier (Colton 5:03 PM, real device) ----
 * Her queue may only hold turns that arrived AFTER the student did something
 * on this visit (sent a reply, picked a choice, pressed a step button), plus
 * the welcome-back line. Restored history never qualifies, whatever woke the
 * audio: a mount, a late server restore, another device's history (no local
 * "heard" marks), the Voice switch, Unmute, an unlock or "Tap to hear" tap.
 * Taps on the voice controls themselves never arm it. Sticky browser
 * activation (navigator.userActivation, true after any tap before an in-app
 * return) is not used. A new route disarms it unless the student's action
 * led there a moment ago (moving on to the next stage).
 */
let armedAt = 0;
let armedPath = "";
const CARRY_MS = 15_000;
const VOICE_CONTROLS = "[data-voice-toggle],[data-replay],[data-tap-to-hear],[data-mic-mute],[data-barge-in],[data-no-arm]";
/** Arms her queue for what comes next (a step or choice button). Never ends the hold. */
function armOnly() {
  armedAt = Date.now();
  armedPath = typeof window === "undefined" ? "" : (window.location?.pathname ?? "");
}
/**
 * The student sent a new message (the composer's Send, typed or spoken): a
 * real action (as is a choice/chip/step tap, via armFromEvent). Arms her
 * queue AND ends the restore hold (below). Toggles, unlock taps, Mute and
 * blank clicks never end it.
 */
export function armSpeech() {
  armOnly();
  holdUntil = 0;
  welcomePlaying = false;
}
export const studentSent = armSpeech;
/** The paper a stage route belongs to (null for the dashboard and others). */
export function stagePaper(path: string): string | null {
  const m = /^\/app\/papers\/([^/]+)\/stage\//.exec(path);
  return m ? m[1]! : null;
}
export function speechArmed(): boolean {
  if (typeof window === "undefined") return true; // unit tests / server
  if (!armedAt) return false;
  const path = (window.location?.pathname ?? "");
  if (path === armedPath) return true;
  // Only a step from one stage to the next of the SAME paper carries the arm
  // (QA 5:44 PM: a dashboard "reopen" tap armed the restored chat).
  const from = stagePaper(armedPath);
  if (from && from === stagePaper(path) && Date.now() - armedAt < CARRY_MS) {
    armedPath = path;
    return true;
  }
  armedAt = 0;
  return false;
}

/*
 * ---- the restore hold (QA 5:44 PM) ----
 * For the first moments after any chat mounts or restores (until the welcome
 * line has finished), only the welcome line may be queued. Everything else is
 * dropped, whatever asked for it (a remount, the Voice switch, Unmute, an
 * unlock tap). An explicit Read aloud tap on a turn still plays that turn.
 * It ends when the welcome line finishes playing, or when the student sends
 * a new message (studentSent). With no welcome line coming (cooldown, Voice
 * off, nothing restored), it lapses after RESTORE_HOLD_MS.
 */
export const RESTORE_HOLD_MS = 8_000;
let holdUntil = 0;
let holdPath = "";
let explicitTapAt = 0;
let welcomePlaying = false;
function currentPath(): string {
  return typeof window === "undefined" ? "" : (window.location?.pathname ?? "");
}
/** A chat mounted or restored: start (or restart) the hold. */
export function beginRestoreHold(ms = RESTORE_HOLD_MS) {
  if (typeof window === "undefined") return;
  holdUntil = Date.now() + ms;
  holdPath = currentPath();
  latestTurn = [];
}
/**
 * A chat component mounted. Unless the student's own action on this page led
 * here, it's a mount/restore: hold for the welcome line, and forget what was
 * "her current turn" on an earlier page (QA 5:44 PM: Voice on after a reopen
 * re-read the old section intro from the previous visit).
 */
export function chatMounted() {
  if (typeof window === "undefined") return;
  if (latestTurnPath !== currentPath()) latestTurn = [];
  if (!speechArmed()) beginRestoreHold();
}
export function restoreHoldActive(): boolean {
  if (!holdUntil) return false;
  if (currentPath() !== holdPath) return false;
  if (welcomePlaying) return true;
  if (Date.now() < holdUntil) return true;
  holdUntil = 0;
  return false;
}
/** A student action (not a voice control): arms her queue for what comes next. */
function armFromEvent(e: Event) {
  const el = e.target as Element | null;
  if (!el || typeof el.closest !== "function") return;
  if (e.type === "keydown") {
    const k = e as KeyboardEvent;
    if (k.key === "Enter" && !k.shiftKey && el.closest("textarea, input")) armOnly();
    return;
  }
  // An explicit Read aloud tap on a turn plays that turn, even in the hold.
  if (el.closest("[data-replay]")) explicitTapAt = Date.now();
  const btn = el.closest("button, [role=button]");
  // A choice, chip or step button is a real action, like a send: it ends the
  // restore hold too (QA 6:18 PM). Voice controls and blank clicks never do.
  if (btn && !btn.closest(VOICE_CONTROLS)) armSpeech();
}
let armInstalled = false;
function installArm() {
  if (armInstalled || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  armInstalled = true;
  window.addEventListener("click", armFromEvent, { capture: true, passive: true });
  window.addEventListener("keydown", armFromEvent, { capture: true, passive: true });
}

let installed = false;
/**
 * A chat mounted (SpeakNew's mount effect): start listening for taps and, if
 * this is a mount or restore, the restore hold (chatMounted).
 */
export function installSpeechUnlock() {
  chatMounted();
  installUnlockListeners();
}
/** Listens once for the first tap or key and for late-loading voices. */
function installUnlockListeners() {
  installArm();
  if (installed || typeof window === "undefined" || typeof window.addEventListener !== "function" || !speechSupported()) return;
  if (!synthSupported()) {
    installed = true;
    // A tap only unlocks audio; it never arms her queue (the restore barrier).
    const onTap = () => {
      unlockSpeech();
    };
    for (const type of ["pointerdown", "touchend", "keydown", "click"] as const) {
      window.addEventListener(type, onTap, { capture: true, passive: true });
    }
    return;
  }
  installed = true;
  const onGesture = () => {
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
let audioUnlocked = false;
export function unlockSpeech() {
  if (!speechSupported()) return;
  preferPlaybackRoute();
  // A "Tap to hear" tap: unlock again inside this gesture.
  if (tapNeeded) audioUnlocked = false;
  const a = getAudio();
  if (a && !audioUnlocked && !active) {
    audioUnlocked = true;
    try {
      a.muted = true;
      a.src = SILENT_WAV;
      const p = a.play();
      if (p && typeof p.then === "function")
        p.then(
          () => {
            // Only stop the silent unlock clip, never a sentence that started meanwhile.
            if (a.src === SILENT_WAV) a.pause();
            a.muted = false;
          },
          () => {
            a.muted = false;
            audioUnlocked = false;
          },
        );
      else a.muted = false;
    } catch {
      a.muted = false;
      audioUnlocked = false;
    }
  }
  setTapNeeded(false);
  if (!synthSupported()) {
    if (queue.length && !active) pump();
    return;
  }
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

/**
 * One spoken turn as few clips as possible (QA 7:21 PM): the first sentence
 * alone, so her voice starts fast (~0.8 s for a short clip vs 1.4-2.3 s for a
 * whole reply), then the rest of the turn as ONE clip, fetched while the first
 * plays, so the rest is one continuous read with natural prosody.
 */
export const GROUP_MAX_CHARS = 420;
export function voiceGroups(sentences: string[]): string[] {
  const s = sentences.map((x) => x.trim()).filter(Boolean);
  if (s.length <= 1) return s;
  let first = s[0]!;
  let i = 1;
  // A very short opener ("Okay.") rides with the next sentence.
  if (first.length < 9 && first.length + s[1]!.length < 140) first = `${first} ${s[i++]!}`;
  const out = [first];
  let cur = "";
  for (; i < s.length; i++) {
    if (cur && cur.length + 1 + s[i]!.length > GROUP_MAX_CHARS) {
      out.push(cur);
      cur = s[i]!;
    } else cur = cur ? `${cur} ${s[i]!}` : s[i]!;
  }
  if (cur) out.push(cur);
  return out;
}
/** Sentences inside a grouped clip (the browser voice reads one at a time). */
export function splitGroup(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$/g)?.map((x) => x.trim()).filter(Boolean);
  return parts?.length ? parts : [text];
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
  setSpeaking(true);
  if (audioSupported() && serverVoice !== "off") {
    const clip = fetchClip(next);
    // Fetch ahead so the next sentence starts without a gap.
    for (const t of queue.slice(0, 3)) void fetchClip(t);
    void clip.then((url) => {
      if (gen !== generation) return;
      if (url) playClip(url, next, gen);
      else if (synthSupported()) speakWithSynth(next, gen);
      else {
        active = false;
        pump();
      }
    });
    return;
  }
  speakWithSynth(next, gen);
}

/** Playback could not start: keep the sentence, stop pretending, ask for a tap. */
function blockedBeforeStart(text: string, gen: number) {
  if (gen !== generation) return;
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
  queue.unshift(text);
  active = false;
  audibleEnded = true;
  setAudible(null);
  setSpeaking(false);
  setTapNeeded(true);
}

function playClip(url: string, next: string, gen: number) {
  const a = getAudio();
  if (!a) return speakWithSynth(next, gen);
  let finished = false;
  let started = false;
  const trim = trims.get(url);
  let seam: ReturnType<typeof setTimeout> | null = null;
  const done = () => {
    if (finished) return;
    finished = true;
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
    if (seam) clearTimeout(seam);
    if (gen !== generation) return;
    audibleEnded = queue.length === 0;
    setAudible(null);
    active = false;
    pump();
  };
  a.onplaying = () => {
    if (gen !== generation || finished) return;
    started = true;
    setTapNeeded(false);
    audibleEnded = false;
    setAudible(next);
    // Playing: allow its real length, then move on even without 'ended'.
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(done, utteranceBudgetMs(next) + 2000);
    // Gapless: hand over where this clip's words end, not after its silence.
    if (trim && !seam) {
      const ms = ((trim.end - (a.currentTime || 0)) / (a.playbackRate || 1)) * 1000;
      if (ms > 0)
        seam = setTimeout(() => {
          if (finished || gen !== generation) return;
          try {
            a.pause();
          } catch {
            /* ignore */
          }
          done();
        }, ms);
    }
  };
  a.onended = done;
  a.onerror = () => {
    if (finished || gen !== generation) return;
    finished = true;
    if (watchdog) clearTimeout(watchdog);
    // A bad clip: say this sentence with the browser voice instead.
    if (!started && synthSupported()) speakWithSynth(next, gen);
    else done();
  };
  a.muted = false;
  a.src = url;
  // Skip the clip's leading silence (applied once its metadata loads).
  if (trim && trim.lead > 0) {
    try {
      a.currentTime = trim.lead;
    } catch {
      /* ignore */
    }
  }
  let p: Promise<void> | undefined;
  try {
    p = a.play();
  } catch {
    p = Promise.reject(new Error("play"));
  }
  p?.catch?.((err: unknown) => {
    if (finished || gen !== generation) return;
    finished = true;
    if ((err as { name?: string } | null)?.name === "NotAllowedError") blockedBeforeStart(next, gen);
    else if (synthSupported()) speakWithSynth(next, gen);
    else blockedBeforeStart(next, gen);
  });
  // No 'playing' within 5s: the clip isn't really playing, so don't claim it is.
  watchdog = setTimeout(() => {
    if (finished || gen !== generation) return;
    if (!started) {
      finished = true;
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      blockedBeforeStart(next, gen);
    }
  }, 5000);
}

function speakWithSynth(next: string, gen: number) {
  const parts = splitGroup(next).flatMap((x) => chunkSentence(x));
  if (parts.length > 1) {
    queue.unshift(...parts.slice(1));
    next = parts[0]!;
  }
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(next);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = 1;
  let finished = false;
  let started = false;
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
      started = true;
      setTapNeeded(false);
      audibleEnded = false;
      setAudible(next);
      // Started: allow its real length, then move on even without onend.
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(done, utteranceBudgetMs(next));
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
  // The engine never started (phones without an unlocking tap): ask for one.
  watchdog = setTimeout(() => {
    if (finished || gen !== generation) return;
    if (!started) {
      finished = true;
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      lastCancelAt = Date.now();
      blockedBeforeStart(next, gen);
    }
  }, 4000);
}

/** Queue Pau Pau's words. `interrupt` replaces anything already playing. */
export function speak(texts: string[], opts: { interrupt?: boolean; welcome?: boolean; explicit?: boolean } = {}) {
  if (!speechSupported()) return;
  // The welcome-back line is recognised by its text; an explicit Read aloud
  // tap by the tap that's running right now.
  const welcome = opts.welcome || (texts.length === 1 && (WELCOME_BACK_LINES as readonly string[]).includes(texts[0]!.trim()));
  const explicit = opts.explicit || Date.now() - explicitTapAt < 250;
  opts = { ...opts, welcome };
  // The restore hold: only the welcome line (or an explicit Read aloud tap).
  if (!welcome && !explicit && restoreHoldActive()) return;
  if (texts.some((t) => t.trim())) spokeThisVisit = true;
  if (opts.welcome) {
    if (opts.interrupt) stopSpeech();
    welcomePlaying = true;
    const gen = generation;
    let started = false;
    const done = () => {
      if (generation !== gen) {
        // Cut off (Voice off): not finished, so the hold goes on by time.
        welcomePlaying = false;
        listeners.delete(done);
        return;
      }
      if (speakingNow) {
        started = true;
        return;
      }
      if (!started) return;
      listeners.delete(done);
      welcomePlaying = false;
      // Held for a tap (blocked audio) is not finished; played to the end is.
      if (!tapNeeded && !queue.length) holdUntil = 0;
    };
    listeners.add(done);
    // Never hold longer than the welcome could take.
    setTimeout(() => {
      welcomePlaying = false;
      listeners.delete(done);
    }, 20_000);
  }
  setTapNeeded(false);
  installUnlockListeners();
  if (opts.interrupt && !opts.welcome) stopSpeech();
  // Server voice: one clip per thought (voiceGroups); the browser voice reads
  // a grouped clip sentence by sentence (speakWithSynth splits it again).
  const sentences = texts.flatMap((t) => speakableSentences(t)).flatMap((x) => chunkSentence(x));
  queue.push(...(audioSupported() && serverVoice !== "off" ? voiceGroups(sentences) : sentences));
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
  setTapNeeded(false);
  if (audioEl) {
    audioEl.onplaying = null;
    audioEl.onended = null;
    audioEl.onerror = null;
    try {
      audioEl.pause();
    } catch {
      /* ignore */
    }
  }
  if (synthSupported()) {
    lastCancelAt = Date.now();
    window.speechSynthesis.cancel();
  }
}

/* ---- which bubbles were already on screen / already read (per paper) ---- */

const seen = new Map<string, Set<string>>();
let latestTurn: string[] = [];
let latestTurnPath = "";

/** `opener`: her greeting/intro on a chat with no student turns yet. */
export type SpeakItem = { key: string; text: string; turn?: boolean; opener?: boolean };

/**
 * Returns the items that are new since the last call for this scope. The first
 * call for a scope (page load / reload) marks everything present as seen, so
 * only bubbles that arrive afterwards are read.
 */
export function takeNew(scope: string, items: SpeakItem[]): SpeakItem[] {
  // Anything this paper already showed or said, on any earlier visit, is never
  // read again (Colton 3:46 PM): restored history stays silent even if it
  // arrives late or under a new key after a reload or a return.
  const opener = items.filter((i) => i.opener && i.text.trim()).map((i) => i.text);
  if (opener.length) visitOpener = { path: currentPath(), texts: opener };
  else if (visitOpener?.path === currentPath()) visitOpener = null;
  const heard = heardFor(scope);
  const before = heard.size;
  const fresh0 = takeNewInner(scope, items).filter((i) => !heard.has(textMark(i.text)));
  for (const i of items) heard.add(textMark(i.text));
  if (heard.size !== before) saveHeard(scope, heard);
  // "Read it now" on the Voice switch only ever means a turn from this visit.
  const turn = fresh0.filter((i) => i.turn).map((i) => i.text);
  if (turn.length) {
    latestTurn = turn;
    latestTurnPath = currentPath();
  }
  // The restore hold drops anything that isn't the welcome line.
  if (restoreHoldActive()) return [];
  return fresh0;
}

/* ---- per-paper "already shown / spoken" marker, saved per user ---- */
const heardCache = new Map<string, Set<string>>();
const paperOf = (scope: string) => scope.split(":")[0] ?? scope;
/** A short stable mark for a line (FNV-1a), so storage never holds her words. */
export function textMark(text: string): string {
  let h = 0x811c9dc5;
  const t = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
function heardFor(scope: string): Set<string> {
  const key = paperOf(scope);
  let set = heardCache.get(key);
  if (set) return set;
  set = new Set();
  try {
    const raw = readScoped(`heard:${key}`);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(list)) for (const m of list) if (typeof m === "string") set.add(m);
  } catch {
    /* ignore a bad entry */
  }
  heardCache.set(key, set);
  return set;
}
function saveHeard(scope: string, set: Set<string>) {
  const list = [...set].slice(-600);
  writeScoped(`heard:${paperOf(scope)}`, JSON.stringify(list));
}
/** A chat (re)mounted: what's on screen at its first pass is restored history. */
export function beginSpeakScope(scope: string) {
  seen.delete(scope);
  beginRestoreHold();
}
/** Mark lines as already said (e.g. the welcome-back line we just spoke). */
export function markHeard(scope: string, texts: string[]) {
  const heard = heardFor(scope);
  texts.forEach((t) => heard.add(textMark(t)));
  saveHeard(scope, heard);
}

function takeNewInner(scope: string, items: SpeakItem[]): SpeakItem[] {
  let set = seen.get(scope);
  // First pass of a chat on this visit: a mount or restore, unless the
  // student's own step just led here (moving on to the next stage).
  if (!set && !speechArmed()) beginRestoreHold();
  // Until the student acts on this visit (see the restore barrier), everything
  // on screen is restored history (a reload or return can swap screens and
  // redraw old bubbles, late), so nothing is read aloud or queued for a tap.
  if (!speechArmed()) {
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

/* ---- demo: Voice on with nothing said yet on this visit (QA 8:45 PM #2) ---- */
let spokeThisVisit = false;
let visitOpener: { path: string; texts: string[] } | null = null;
const openerUsed = new Set<string>();
/**
 * Demo only: the greeting/intro on screen, once per page per visit, when the
 * student turns Voice on and nothing has been said yet. Only chats with no
 * student turns flag an opener, so a return never replays old turns.
 */
export function takeVisitOpener(): string[] {
  if (localUser() !== "demo" || spokeThisVisit) return [];
  const path = currentPath();
  if (!visitOpener || visitOpener.path !== path || openerUsed.has(path)) return [];
  openerUsed.add(path);
  return visitOpener.texts;
}

/** Pau Pau's current turn, for "read it now" when voice is switched on. */
export function currentTurn(): string[] {
  const turn = restoreHoldActive() || latestTurnPath !== currentPath() ? [] : latestTurn;
  if (turn.length) return turn;
  // Demo, nothing said yet on this visit: the greeting/intro once. The Voice
  // tap is the student's own action, so it plays through the restore hold.
  const opener = takeVisitOpener();
  if (opener.length) explicitTapAt = Date.now();
  return opener;
}

/** Test helper. */
export function __resetSpeech() {
  holdUntil = 0;
  holdPath = "";
  explicitTapAt = 0;
  welcomePlaying = false;
  armedAt = 0;
  armedPath = "";
  seen.clear();
  heardCache.clear();
  latestTurn = [];
  latestTurnPath = "";
  spokeThisVisit = false;
  visitOpener = null;
  openerUsed.clear();
  queue = [];
  active = false;
  unlocked = false;
  lastCancelAt = 0;
  cachedVoice = undefined;
  serverVoice = "unknown";
  serverFailures = 0;
  clips.clear();
  audioEl = null;
  audioUnlocked = false;
  tapNeeded = false;
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

/** Test helper: force the browser voice (no server clips). */
export function __browserVoiceForTest() {
  serverVoice = "off";
}

/** Test helper: pretend the student already tapped. */
export function __unlockForTest() {
  unlocked = true;
}
