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
  /** Talking over her must be sustained this long (voiced frames) before she pauses: longer than a cough/door/click with its tail. */
  sustainMs: 600,
  /** Up to three quiet frames (300 ms) inside a run don't reset it (breaths, pauses between words); only voiced frames count toward sustainMs. */
  gapFrames: 3,
  /** Floor RMS for "voiced" while she talks or is about to (0..1 full scale). The transcript
   *  verdict catches loud noise that gets past this, so it stays low enough for quiet talkers. */
  guardFloorRms: 0.04,
  /** Mic must be this much louder than her measured echo to count as the student. */
  echoMargin: 3,
  /** Cap on the learned echo coupling (mic/out loudness ratio). */
  maxCoupling: 2,
  /** Floor RMS for "voiced" when she is quiet (server VAD decides the rest). */
  idleFloorRms: 0.02,
  /** How much mic audio before a barge is kept so their first words aren't lost. */
  rollMs: 1_200,
  /** Relay: after a barge-in pause, no speech heard by the server within this = noise (resume). */
  verdictTimeoutMs: 1_200,
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
    // Grace: her first ~1.5 s always plays, as if the mic were muted (nothing counts toward a barge).
    if (o.playing && this.inGrace(o.now)) {
      this.reset();
      return "hold";
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

/* ---------------- PC-29 QA round 2: one question at a time, and it's the app's ---------------- */

/**
 * Complete sentences in `text` starting at `from`. A "?" ends a sentence at once; "." and "!"
 * need a following space (or `final`), so "3.5" or a half-streamed "Mr." isn't a sentence end.
 */
export function completeSentences(text: string, from: number, final = false): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  let start = from;
  for (let i = from; i < text.length; i++) {
    const c = text[i]!;
    if (c !== "?" && c !== "." && c !== "!") continue;
    // Swallow closing quotes/brackets and repeated marks.
    let j = i + 1;
    while (j < text.length && /[?!.\"”’')\]]/.test(text[j]!)) j++;
    const atEnd = j >= text.length;
    if (c !== "?" && !(text[j] === " " || text[j] === "\n" || (atEnd && final))) continue;
    out.push({ start, end: j, text: text.slice(start, j) });
    start = j;
    i = j - 1;
  }
  return out;
}

/** The question sentences of a prompt. */
export function questionsOf(prompt: string): string[] {
  return completeSentences(prompt, 0, true)
    .map((s) => s.text.trim())
    .filter((s) => s.endsWith("?") || /\?["”’')\]]*$/.test(s));
}

/**
 * May she ask this question? Only if it is the on-screen prompt's question in (nearly) its
 * exact words: most of its word pairs appear in one of the prompt's questions.
 */
export function questionAllowed(question: string, prompt: string): boolean {
  const q = wordsOf(question);
  if (!q.length) return true;
  const qs = questionsOf(prompt);
  if (!qs.length) return false;
  return qs.some((p) => {
    if (q.length < 2) return wordsOf(p).includes(q[0]!);
    // Containment both ways: "Where are you with it?" inside a longer on-screen line, or a lead-in.
    const pw = wordsOf(p).join(" ");
    const qw = q.join(" ");
    if (pw.includes(qw) || qw.includes(pw)) return true;
    return overlap(question, p) >= 0.7;
  });
}

/* ---------------- PC-29c: a stray question is lifted out, not a cliff ---------------- */

/**
 * Stage 1 question-gate tunables. Production (Colton, 2026-11-25 ~12:01 MT) showed every
 * "cut herself off" was this gate ending her reply at an off-screen question (questionsCut 3,
 * barge counters 0): the rest of her explanation was thrown away, and the cut point was a
 * chars x ms-per-char guess that could land mid-word.
 */
export const QGATE_TUNING = {
  /** Audio kept unreleased behind the last cleared sentence, so a cut can still move back to a pause. */
  holdbackMs: 650,
  /** How far either side of the estimated sentence boundary to look for a pause. */
  searchBackMs: 600,
  searchAheadMs: 700,
  /** Analysis frame. */
  frameMs: 20,
  /** A pause between sentences: this long and quiet... */
  pauseMs: 140,
  /** ...or, failing that, at least a gap between words. */
  minGapMs: 40,
  /** "Quiet" = frame RMS below this share of the reply's median frame RMS (and an absolute floor). */
  quietRatio: 0.18,
  quietFloor: 120,
} as const;

/** RMS of each `frameMs` frame of 16-bit little-endian mono PCM. */
export function frameRms(pcm: Buffer, rate: number, frameMs: number = QGATE_TUNING.frameMs): number[] {
  const per = Math.max(1, Math.round((rate * frameMs) / 1000));
  const n = Math.floor(pcm.length / 2);
  const out: number[] = [];
  for (let f = 0; f + per <= n; f += per) {
    let s = 0;
    for (let i = f; i < f + per; i++) {
      const v = pcm.readInt16LE(i * 2);
      s += v * v;
    }
    out.push(Math.sqrt(s / per));
  }
  return out;
}

/**
 * The best place to cut her audio near `nearMs`: the middle of the closest real pause
 * (>= pauseMs of quiet) inside [loMs, hiMs], else the closest gap between words (>= minGapMs),
 * else `nearMs` itself. Never lands inside a word when there's any quiet to land on.
 */
export function quietCutPoint(pcm: Buffer, rate: number, nearMs: number, loMs: number, hiMs: number, t: Partial<typeof QGATE_TUNING> = {}): number {
  const T = { ...QGATE_TUNING, ...t };
  const rms = frameRms(pcm, rate, T.frameMs);
  if (!rms.length) return nearMs;
  const sorted = [...rms].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const thr = Math.max(T.quietFloor, median * T.quietRatio);
  const f0 = Math.max(0, Math.floor(loMs / T.frameMs));
  const f1 = Math.min(rms.length, Math.ceil(hiMs / T.frameMs));
  const runs: { mid: number; len: number }[] = [];
  let s = -1;
  for (let f = f0; f <= f1; f++) {
    const quiet = f < f1 && rms[f]! < thr;
    if (quiet && s < 0) s = f;
    if (!quiet && s >= 0) {
      runs.push({ mid: ((s + f) / 2) * T.frameMs, len: (f - s) * T.frameMs });
      s = -1;
    }
  }
  const pick = (min: number) =>
    runs.filter((r) => r.len >= min).sort((a, b) => Math.abs(a.mid - nearMs) - Math.abs(b.mid - nearMs))[0];
  return (pick(T.pauseMs) ?? pick(T.minGapMs))?.mid ?? nearMs;
}

/** `text` up to `upto` with the lifted-out [from, to) ranges removed, tidied. */
export function textWithout(text: string, ranges: { from: number; to: number }[], upto = text.length): string {
  let out = "";
  let at = 0;
  for (const r of [...ranges].sort((a, b) => a.from - b.from)) {
    if (r.from >= upto) break;
    out += text.slice(at, Math.min(r.from, upto));
    at = Math.max(at, r.to);
  }
  if (at < upto) out += text.slice(at, upto);
  return out.replace(/\s{2,}/g, " ").trim();
}

/** A new app turn waits for her to finish (Stage 1 verbatim prompts) instead of cutting her off. */
export function sayTurnWaits(opts: { spoken?: string }): boolean {
  return typeof opts.spoken === "string";
}
