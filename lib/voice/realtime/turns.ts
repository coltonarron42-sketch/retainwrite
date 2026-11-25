/**
 * PC-29 (Colton t194u): turn-taking rules for the Grok Voice call, kept pure so
 * they're unit-tested without a browser. Used by the browser client (barge-in
 * gate, playback position) and the relay (noise turns, repeats, cut-off remainder).
 *
 * xAI's server_vad exposes no sensitivity knobs (docs: only `type` and
 * `idle_timeout_ms`), so sensitivity lives here, on the client, before any mic
 * audio reaches the server while she talks.
 */

/** Tunables (all ms unless noted). Chosen for laptop speakers + phone; see PLAN.md 9. */
export const TURN_TUNING = {
  /** Mic frames are 100 ms (2,400 samples at 24 kHz). */
  frameMs: 100,
  /** Barge-in is ignored this long after her audio starts (her first words always land). */
  graceMs: 1_500,
  /** Talking over her must be sustained this long before she pauses. */
  sustainMs: 500,
  /** One quiet frame inside a run doesn't reset it (breaths between words). */
  gapFrames: 1,
  /** Floor RMS for "voiced" while she talks or is about to (0..1 full scale). */
  guardFloorRms: 0.06,
  /** Mic must be this much louder than her measured echo to count as the student. */
  echoMargin: 3,
  /** Cap on the learned echo coupling (mic/out loudness ratio). */
  maxCoupling: 2,
  /** Floor RMS for "voiced" when she is quiet (server VAD decides the rest). */
  idleFloorRms: 0.02,
  /** How much mic audio before a barge is kept so their first words aren't lost. */
  rollMs: 1_200,
  /** Relay: after a barge-in pause, no turn heard within this (and no speech in progress) = noise. */
  verdictTimeoutMs: 2_500,
  /** Relay: never wait longer than this for a verdict, even while speech goes on. */
  verdictMaxMs: 6_000,
  /** Client fallback if the relay's verdict never arrives: resume her reply. */
  clientVerdictTimeoutMs: 7_000,
  /** Relay: hold a reply's audio at most this long while checking for a noise turn or a repeat. */
  holdMaxMs: 1_500,
  /** Typing counts as active this long after the last keystroke in a focused composer. */
  typingIdleMs: 3_000,
} as const;

export type BargeDecision =
  /** Not her turn: send the mic as is. */
  | "pass"
  /** Her turn just ended while they were already talking: send the rolled-back audio, then this frame. */
  | "flush"
  /** Her turn: send silence upstream (echo / noise / grace). */
  | "hold"
  /** Sustained talk over her: pause her playback and send the rolled-back audio. */
  | "barge";

/**
 * Decides, frame by frame, whether the student is really talking over her.
 * Frames are fed in order; `guarded` is true while she plays, is about to reply,
 * or her echo tail is still in the room.
 */
export class BargeGate {
  private run = 0;
  private gap = 0;
  private herStartAt = 0;
  constructor(private t: typeof TURN_TUNING = TURN_TUNING) {}

  /** Her audio for a new reply started playing at `now`. */
  herAudioStarted(now: number) {
    this.herStartAt = now;
    this.reset();
  }

  reset() {
    this.run = 0;
    this.gap = 0;
  }

  inGrace(now: number): boolean {
    return this.herStartAt > 0 && now - this.herStartAt < this.t.graceMs;
  }

  /** Voiced threshold: louder than a floor and clearly louder than her own echo. */
  threshold(herOutRms: number, coupling: number, guarded: boolean): number {
    if (!guarded) return this.t.idleFloorRms;
    return Math.max(this.t.guardFloorRms, this.t.echoMargin * coupling * herOutRms);
  }

  frame(o: { now: number; rms: number; guarded: boolean; playing: boolean; herOutRms: number; coupling: number }): BargeDecision {
    if (!o.guarded) {
      const talking = this.run > 0;
      this.reset();
      return talking ? "flush" : "pass";
    }
    const voiced = o.rms > this.threshold(o.herOutRms, o.coupling, true);
    if (voiced) {
      this.run += 1;
      this.gap = 0;
    } else if (this.run > 0 && this.gap < this.t.gapFrames) {
      this.gap += 1;
    } else {
      this.reset();
    }
    // Grace: her first ~1.5 s always plays; a run that started inside it still counts after.
    if (o.playing && this.inGrace(o.now)) return "hold";
    if (voiced && this.run * this.t.frameMs >= this.t.sustainMs) {
      this.reset();
      return "barge";
    }
    return "hold";
  }
}

const FILLER = new Set(["uh", "um", "umm", "uhm", "hmm", "hm", "mm", "mmm", "mhm", "ah", "oh", "er", "erm", "eh", "huh", "ha", "haha", "shh", "psst"]);
/** Common ASR hallucinations on noise (counted as noise only when they are the whole transcript during a barge). */
const NOISE_PHRASES = new Set(["you", "thank you", "thanks", "thank you very much", "bye", "the", "a", "i", "so", "and", "okay okay", "thanks for watching"]);
/** One-word barge-ins that are real (the student wants her to stop or is reacting). */
const BARGE_WORDS = new Set(["stop", "wait", "hold", "hang", "pau", "pow", "sorry", "no", "nope", "yes", "yeah", "yep", "okay", "ok", "what", "hey", "actually", "but", "huh?"]);

export function wordsOf(t: string): string[] {
  return t
    .toLowerCase()
    .replace(/[\u2019]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Words that carry meaning (fillers removed). */
export function realWords(t: string): string[] {
  return wordsOf(t).filter((w) => !FILLER.has(w));
}

/**
 * Is this "student turn" just noise? Empty or filler-only always is. While she
 * was talking (a barge), a lone word must be an interrupt word and the classic
 * noise hallucinations ("thank you", "you") don't count.
 */
export function isNoiseTurn(transcript: string, duringHer: boolean): boolean {
  const w = realWords(transcript);
  if (!w.length) return true;
  if (!duringHer) return false;
  if (NOISE_PHRASES.has(w.join(" "))) return true;
  if (w.length === 1 && !BARGE_WORDS.has(w[0]!)) return true;
  return false;
}

const bigrams = (w: string[]) => new Set(w.slice(1).map((x, i) => `${w[i]} ${x}`));

/** 0..1: share of `a`'s word pairs that also appear in `b`. */
export function overlap(a: string, b: string): number {
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (wa.length < 2 || wb.length < 2) return 0;
  const B = bigrams(wb);
  const A = [...bigrams(wa)];
  if (!A.length) return 0;
  return A.filter((p) => B.has(p)).length / A.length;
}

/**
 * Is her reply-in-progress a repeat of something she just said? Only judged once
 * it has enough words to be sure (a short "Nice." is never a repeat).
 */
export function isRepeat(soFar: string, recent: string[], minWords = 8, min = 0.75): boolean {
  if (wordsOf(soFar).length < minWords) return false;
  return recent.some((r) => r && overlap(soFar, r) >= min);
}

/**
 * The part of her line the student didn't hear: words after the played share
 * of the audio. Approximate (speech rate is roughly even), word-aligned.
 */
export function unplayedRemainder(transcript: string, playedMs: number, totalMs: number): string {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text || totalMs <= 0) return "";
  const share = Math.max(0, Math.min(1, playedMs / totalMs));
  if (share >= 0.97) return "";
  const parts = text.split(" ");
  const cut = Math.floor(parts.length * share);
  return parts.slice(cut).join(" ");
}

/**
 * Tracks what of her current reply has actually played, so a pause can resume
 * from the same spot (noise) or be truncated at the right ms (a real barge-in).
 * Pure bookkeeping on PCM chunk lengths; the client owns the AudioContext.
 */
export class PlaybackLedger {
  /** Chunks of the current reply, in order, with when they're scheduled to start (s, audio clock). */
  private chunks: { at: number; dur: number; pcm: Float32Array }[] = [];
  rid: string | null = null;
  /** Audio of this reply that played before a pause (a resume starts a fresh ledger on top). */
  private offsetMs = 0;

  /** Returns true when this is a new reply. */
  begin(rid: string, offsetMs = 0): boolean {
    if (this.rid === rid) return false;
    this.rid = rid;
    this.chunks = [];
    this.offsetMs = offsetMs;
    return true;
  }

  /** Resume after a pause: same reply, the already-played part is kept as an offset. */
  rebase(playedMs: number) {
    this.chunks = [];
    this.offsetMs = playedMs;
  }

  add(at: number, pcm: Float32Array, rate: number) {
    this.chunks.push({ at, dur: pcm.length / rate, pcm });
  }

  totalMs(): number {
    return Math.round(this.offsetMs + this.chunks.reduce((s, c) => s + c.dur, 0) * 1000);
  }

  /** How much has played at audio-clock time `now` (ms). */
  playedMs(now: number): number {
    let ms = this.offsetMs;
    for (const c of this.chunks) {
      if (now <= c.at) break;
      ms += Math.min(c.dur, now - c.at) * 1000;
    }
    return Math.round(ms);
  }

  /** The unplayed PCM from `now` on (for resuming after a false barge-in). */
  remainingPcm(now: number, rate: number): Float32Array[] {
    const out: Float32Array[] = [];
    for (const c of this.chunks) {
      const end = c.at + c.dur;
      if (end <= now) continue;
      if (c.at >= now) out.push(c.pcm);
      else out.push(c.pcm.subarray(Math.floor((now - c.at) * rate)));
    }
    return out;
  }

  clear() {
    this.chunks = [];
    this.rid = null;
    this.offsetMs = 0;
  }
}

/**
 * Typing beats talking: the mic pauses while the student types in a focused
 * composer (recent keystroke, or text in the box); on a typed-answer prompt, focus is enough.
 */
export function typingActive(s: { focused: boolean; lastKeyAt: number; hasText: boolean; typedPrompt: boolean }, now: number, idleMs: number = TURN_TUNING.typingIdleMs): boolean {
  if (!s.focused) return false;
  // A typed-answer prompt (e.g. pasting the assignment): focus alone pauses the mic.
  if (s.typedPrompt) return true;
  return s.hasText || (s.lastKeyAt > 0 && now - s.lastKeyAt < idleMs);
}
