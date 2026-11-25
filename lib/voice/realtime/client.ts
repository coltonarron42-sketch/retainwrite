"use client";

/**
 * Browser side of the Grok Voice realtime PoC. One AudioContext per call,
 * created inside the student's tap. Mic -> PCM16 24 kHz binary frames -> our
 * relay. Output deltas play gapless with a small lead; barge-in stops them.
 * The browser never holds an xAI key and never sends session config.
 */
import { typingArbiter } from "./arbiter";
import { BargeGate, PlaybackLedger, sayTurnWaits, TURN_TUNING } from "./turns";

export type RtPhase = "off" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export type RtEvents = {
  phase?: (p: RtPhase) => void;
  userTranscript?: (itemId: string, text: string, final: boolean) => void;
  userCommitted?: (itemId: string) => void;
  pauDelta?: (responseId: string, text: string) => void;
  /** A "student" turn that was really her own voice through speakers: hide it. */
  echo?: (itemId: string) => void;
  pauDone?: (responseId: string, status: string | undefined) => void;
  pauCancelled?: (responseId: string) => void;
  saveNote?: (callId: string, text: string, itemId: string, kind?: string) => Promise<{ ok: boolean; result: string; screen?: string; spoken?: string }>;
  sources?: (links: { title: string; url: string; why?: string }[]) => void;
  error?: (message: string) => void;
  metric?: (m: { e2eMs?: number; bargeMs?: number }) => void;
  /** PC-29: the mic is paused because the student is typing. */
  typing?: (on: boolean) => void;
  /** PC-29: a reply the relay dropped (noise turn, typed turn, repeat): hide it without touching playback. */
  pauDropped?: (responseId: string) => void;
};

const RATE = 24_000;
const CHUNK = 2_400; // 100 ms
const LEAD_S = 0.06;
/** Room echo and capture delay after her last sample. */
const ECHO_TAIL_MS = 250;
const VOICE_RMS = 0.02;
/** Client end-of-turn: this much silence after speech ends her wait (server VAD waits ~0.5-0.9 s more). */
const END_SILENCE_MS = 360;
const MIN_SPEECH_MS = 250;
const PREROLL = 3;

const WORKLET = `
class Cap extends AudioWorkletProcessor {
  constructor(o){ super(); this.ratio = o.processorOptions.ratio; this.buf = []; this.pos = 0; this.chunk = o.processorOptions.chunk; this.out = new Int16Array(this.chunk); this.n = 0; this.sum = 0; }
  process(inputs){
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = Math.max(-1, Math.min(1, ch[i]));
        this.sum += v * v;
        this.out[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.n === this.chunk) {
          this.port.postMessage({ pcm: this.out.buffer, rms: Math.sqrt(this.sum / this.chunk) }, [this.out.buffer]);
          this.out = new Int16Array(this.chunk); this.n = 0; this.sum = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('rw-cap', Cap);`;

function b64ToPcm(b64: string): Float32Array {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v & 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

/** Soft gate: give up on the spoken line if her reply hasn't started by then. */
export const GATE_CONNECT_MS = 8000;

export class RealtimeVoice {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private ws: WebSocket | null = null;
  private out: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  private early: ArrayBuffer[] = [];
  private muted = false;
  private phase: RtPhase = "off";
  private responding = false;
  private stopped = false;
  private lastVoiceAt = 0;
  private voiceOnsetAt = 0;
  private speechStoppedAt = 0;
  private pendingE2E: number | null = null;
  private cancelled = new Set<string>();
  private resume: string | null = null;
  private started = false;
  private levelBuf = new Uint8Array(256);
  private inSpeech = false;
  private voicedRun = 0;
  private onsetAt = 0;
  private speechStartAt = 0;
  private silenceSince = 0;
  private preroll: ArrayBuffer[] = [];
  private screenMsg: Record<string, unknown> | null = null;
  private outFrames: { t: number; rms: number }[] = [];
  private echoTailUntil = 0;
  private echoRatios: number[] = [];
  private gateDone = false;
  private gateHeard = false;
  // PC-29 turn-taking.
  private gate = new BargeGate();
  private ledger = new PlaybackLedger();
  /** Her reply paused by a possible barge-in, waiting for the relay's verdict (real words or noise). */
  private paused: { rid: string | null; remaining: Float32Array[]; playedMs: number; timer: ReturnType<typeof setTimeout> } | null = null;
  /** After a confirmed barge-in, the mic goes straight up until the server hears the end of their turn. */
  private listenOpen = false;
  private roll: ArrayBuffer[] = [];
  private typing = false;
  private unsubTyping: (() => void) | null = null;
  private resumeToken: string | null = null;
  private reconnects = 0;
  /** What she was saying when the socket dropped (re-said after a reconnect). */
  private dropRemainder = "";
  private herText = new Map<string, string>();
  private respRid: string | null = null;

  constructor(
    private paperId: string,
    private on: RtEvents,
    private opts: { welcome: boolean; welcomeIndex: number; welcomeText?: string | null; effort?: "none" | "high"; vad?: "client" | "server"; tuning?: Record<string, string>; gate?: number; stage?: 1 | 2 | 3 },
  ) {}

  /** Call inside the tap. */
  async start(): Promise<void> {
    this.stopped = false;
    this.setPhase("connecting");
    if (!this.opts.gate) {
      this.typing = typingArbiter.isTyping();
      this.unsubTyping = typingArbiter.subscribe((t) => this.setTyping(t));
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    let ctx: AudioContext;
    try {
      ctx = new Ctx({ sampleRate: RATE, latencyHint: "interactive" });
    } catch {
      ctx = new Ctx({ latencyHint: "interactive" });
    }
    this.ctx = ctx;
    void ctx.resume();
    this.out = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.out.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    if (this.opts.gate) {
      // Soft gate: speak-only. No mic; if the browser blocks audio, say nothing (text shows).
      await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 400))]);
      if (ctx.state !== "running") {
        this.on.error?.("audio_blocked");
        this.stop();
        return;
      }
      this.connect();
      // A gate line that hasn't started within GATE_CONNECT_MS is dropped (text stays).
      setTimeout(() => {
        if (!this.stopped && !this.gateHeard) {
          this.on.error?.("gate_timeout");
          this.stop();
        }
      }, GATE_CONNECT_MS);
      return;
    }
    this.connect();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const src = ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(ctx, "rw-cap", { processorOptions: { ratio: ctx.sampleRate / RATE, chunk: CHUNK } });
      this.node.port.onmessage = (ev: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => this.onMic(ev.data.pcm, ev.data.rms);
      src.connect(this.node);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      this.node.connect(sink).connect(ctx.destination);
    } catch (err) {
      this.on.error?.((err as Error)?.name === "NotAllowedError" ? "Mic blocked. Allow it in your browser, or type." : "Couldn't open your mic. You can still type.");
    }
  }

  private connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const q = new URLSearchParams({ paperId: this.paperId });
    if (this.opts.effort) q.set("effort", this.opts.effort);
    q.set("vad", this.opts.vad ?? "server");
    for (const [k, v] of Object.entries(this.opts.tuning ?? {})) q.set(k, v);
    const resume = this.resume ?? (this.reconnects > 0 ? this.resumeToken : null);
    if (resume) q.set("resume", resume);
    if (this.opts.gate) q.set("gate", String(this.opts.gate));
    if (this.opts.stage === 1 || this.opts.stage === 3) q.set("stage", String(this.opts.stage));
    const ws = new WebSocket(`${proto}://${location.host}/api/voice/realtime?${q}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      for (const b of this.early.splice(0)) ws.send(b);
      if (!this.started) {
        this.started = true;
        ws.send(JSON.stringify({ type: "rw.start", welcome: this.opts.welcome, welcomeIndex: this.opts.welcomeIndex, welcomeText: this.opts.welcomeText ?? null }));
      }
      if (this.screenMsg) ws.send(JSON.stringify({ ...this.screenMsg, followUp: false }));
      if (this.typing) ws.send(JSON.stringify({ type: "rw.typing", on: true }));
      if (this.reconnects > 0 && this.dropRemainder) ws.send(JSON.stringify({ type: "rw.resume_hint", remainder: this.dropRemainder }));
      this.dropRemainder = "";
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        this.onServer(JSON.parse(ev.data) as Record<string, unknown>);
      } catch {}
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return;
      if (ev.code === 4000 && this.resume) return this.connect(); // rotation before the 800 s cap
      // PC-29: a glitch (network drop, upstream hiccup) reconnects with resumption instead of
      // ending the call; what she was saying is picked up from where the student stopped hearing it.
      if (!this.opts.gate && ev.code !== 1000 && ev.code !== 1008 && this.resumeToken && this.reconnects < 2) {
        this.reconnects++;
        const rem = this.cutReport().remainder;
        if (rem) this.dropRemainder = rem;
        this.hardStop();
        this.responding = false;
        this.setPhase("connecting");
        setTimeout(() => !this.stopped && this.connect(), 300 * this.reconnects);
        return;
      }
      this.setPhase("error");
      this.on.error?.(ev.code === 1008 || ev.code === 1006 ? "Voice disconnected. Tap the voice button to reconnect, or type." : "Voice ended. Tap to reconnect, or type.");
    };
  }

  private sendAudio(pcm: ArrayBuffer) {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(pcm);
    else if (this.early.length < 80) this.early.push(pcm);
  }

  /** Client VAD: stream only while they talk (plus a short pre-roll), commit after a short silence. */
  private onMicClient(pcm: ArrayBuffer, rms: number) {
    const now = performance.now();
    if (this.muted || this.stopped) {
      this.inSpeech = false;
      this.voicedRun = 0;
      return;
    }
    const playing = this.sources.size > 0;
    const voiced = rms > (playing ? 0.05 : 0.025);
    if (!this.inSpeech) {
      this.voicedRun = voiced ? this.voicedRun + 1 : 0;
      if (this.voicedRun === 1) this.onsetAt = now - 100;
      this.preroll.push(pcm);
      if (this.preroll.length > PREROLL) this.preroll.shift();
      if (this.voicedRun >= (playing ? 2 : 1)) {
        this.inSpeech = true;
        this.speechStartAt = now;
        this.silenceSince = 0;
        this.lastVoiceAt = now;
        if (playing || this.responding) {
          this.stopPlayback();
          this.send({ type: "response.cancel" });
          if (playing) {
            const barge = Math.round(performance.now() - this.onsetAt);
            this.on.metric?.({ bargeMs: barge });
            this.send({ type: "rw.metric", barge_ms: barge });
          }
        }
        this.pendingE2E = null;
        this.send({ type: "rw.clear" });
        for (const b of this.preroll.splice(0)) this.sendAudio(b);
        this.setPhase("listening");
      }
      return;
    }
    this.sendAudio(pcm);
    if (voiced) {
      this.lastVoiceAt = now;
      this.silenceSince = 0;
      return;
    }
    if (!this.silenceSince) this.silenceSince = now;
    if (now - this.silenceSince < END_SILENCE_MS) return;
    this.inSpeech = false;
    this.voicedRun = 0;
    if (this.lastVoiceAt - this.speechStartAt + 100 < MIN_SPEECH_MS) {
      this.send({ type: "rw.clear" });
      return;
    }
    // The chunk is posted at its end; voice ended somewhere inside it (about 50 ms earlier on average).
    this.pendingE2E = this.lastVoiceAt - 50;
    this.speechStoppedAt = now;
    this.send({ type: "rw.commit" });
    this.setPhase("thinking");
  }

  private onMic(pcm: ArrayBuffer, rms: number) {
    if ((this.opts.vad ?? "server") === "client") return this.onMicClient(pcm, rms);
    const now = performance.now();
    if (rms > VOICE_RMS) {
      if (this.sources.size && !this.voiceOnsetAt) this.voiceOnsetAt = now; // barge-in timing
      this.lastVoiceAt = now;
    }
    if (this.muted || this.stopped) {
      this.gate.reset();
      this.roll.length = 0;
      return;
    }
    // One input channel at a time: while they type, the mic sends silence (the server VAD
    // never starts a spoken turn that would compete with the typed one).
    if (this.typing) {
      this.gate.reset();
      this.roll.length = 0;
      this.sendAudio(new ArrayBuffer(pcm.byteLength));
      return;
    }
    // A confirmed barge-in (or a pause waiting on its verdict): their words go straight up.
    if (this.listenOpen) {
      this.sendAudio(pcm);
      return;
    }
    // Speakers without headphones: her own voice comes back through the mic. While she
    // plays, is about to reply, or her echo tail is in the room, only sustained sound
    // clearly louder than her echo counts as the student (PC-29 gate); the rest goes up
    // as silence, so neither the server VAD nor the transcript hears echo or room noise.
    const playing = this.sources.size > 0;
    const guarded = playing || this.responding || now < this.echoTailUntil;
    const out = this.outRms();
    if (playing && out > 0.02) {
      this.echoRatios.push(rms / out);
      if (this.echoRatios.length > 40) this.echoRatios.shift();
    }
    // Echo level = a low percentile of recent mic/out ratios (talking over her mustn't teach the
    // gate that their voice is "echo"), capped so a loud room can't make barge-in impossible.
    const recent = this.echoRatios.slice(-20).sort((a, b) => a - b);
    const coupling = recent.length >= 3 ? Math.min(TURN_TUNING.maxCoupling, recent[Math.floor(recent.length * 0.3)]!) : 1;
    const d = this.gate.frame({ now, rms, guarded, playing, herOutRms: out, coupling });
    if (d === "pass" || d === "flush") {
      // Their words that began over her tail aren't lost when her turn ends mid-word.
      if (d === "flush") for (const b of this.roll) this.sendAudio(b);
      this.roll.length = 0;
      this.sendAudio(pcm);
      return;
    }
    this.roll.push(pcm);
    const maxRoll = Math.round(TURN_TUNING.rollMs / TURN_TUNING.frameMs);
    if (this.roll.length > maxRoll) this.roll.splice(0, this.roll.length - maxRoll);
    if (d === "hold") {
      this.sendAudio(new ArrayBuffer(pcm.byteLength));
      return;
    }
    // Sustained talk over her: pause (not drop) her reply and let the server hear them.
    this.pauseForBarge(now);
    for (const b of this.roll.splice(0)) this.sendAudio(b);
  }

  /** Played/total ms of her current reply and the words the student hasn't heard yet. */
  private cutReport(): { rid: string | null; playedMs: number; totalMs: number; remainder: string } {
    const t = this.ctx?.currentTime ?? 0;
    const playedMs = this.paused ? this.paused.playedMs : this.ledger.playedMs(t);
    const totalMs = this.ledger.totalMs();
    const text = this.ledger.rid ? (this.herText.get(this.ledger.rid) ?? "") : "";
    let remainder = "";
    if (text && totalMs > 0) {
      const share = Math.min(1, playedMs / totalMs);
      if (share < 0.97) {
        const parts = text.replace(/\s+/g, " ").trim().split(" ");
        remainder = parts.slice(Math.floor(parts.length * share)).join(" ");
      }
    }
    return { rid: this.ledger.rid, playedMs, totalMs, remainder };
  }

  /** Possible barge-in: stop her audio but keep the unplayed part until the relay's verdict. */
  private pauseForBarge(now: number) {
    const ctx = this.ctx;
    const playing = this.sources.size > 0;
    const rep = playing ? this.cutReport() : { rid: this.responding ? this.respRid : null, playedMs: 0, totalMs: 0, remainder: "" };
    const remaining = ctx && playing ? this.ledger.remainingPcm(ctx.currentTime, RATE) : [];
    if (this.sources.size) {
      const barge = Math.round(now - (this.voiceOnsetAt || now) + 100);
      this.on.metric?.({ bargeMs: barge });
      this.send({ type: "rw.metric", barge_ms: barge });
    }
    this.hardStop();
    if (this.paused) clearTimeout(this.paused.timer);
    this.paused = {
      rid: rep.rid,
      remaining,
      playedMs: rep.playedMs,
      // No verdict in time (the server never heard a turn): it was noise, carry on.
      timer: setTimeout(() => this.onVerdict(false, rep.rid), TURN_TUNING.clientVerdictTimeoutMs),
    };
    this.listenOpen = true;
    this.echoTailUntil = 0;
    this.voiceOnsetAt = 0;
    this.send({ type: "rw.barge", response_id: rep.rid, played_ms: rep.playedMs, total_ms: rep.totalMs, remainder: rep.remainder.slice(0, 600) });
    this.setPhase("listening");
  }

  /** The relay heard the barge-in's words (real) or nothing worth answering (noise). */
  private onVerdict(real: boolean, rid?: string | null) {
    const p = this.paused;
    if (!p || (rid !== undefined && rid !== null && p.rid !== null && rid !== p.rid)) {
      if (!real) this.listenOpen = false;
      return;
    }
    clearTimeout(p.timer);
    this.paused = null;
    if (real) {
      // They really talked over her: the rest of that reply is dropped here (the relay keeps
      // the unheard words so she can come back to the point after answering them).
      if (p.rid) this.cancelled.add(p.rid);
      this.ledger.clear();
      return;
    }
    // Noise: no new turn; she carries on from the exact spot she paused.
    this.listenOpen = false;
    this.gate.reset();
    if (p.rid && p.remaining.length) {
      if (this.ledger.rid === p.rid) this.ledger.rebase(p.playedMs);
      for (const c of p.remaining) this.play(c, p.rid, true);
    } else if (!this.responding) {
      this.setPhase("listening");
    }
  }

  private setTyping(on: boolean) {
    if (this.typing === on) return;
    this.typing = on;
    this.on.typing?.(on);
    this.send({ type: "rw.typing", on });
  }

  /** Loudness of what she is playing right now (last ~150 ms), from the scheduled PCM. */
  private outRms(): number {
    const ctx = this.ctx;
    if (!ctx || !this.outFrames.length) return 0;
    const t = ctx.currentTime;
    while (this.outFrames.length && this.outFrames[0]!.t < t - 1) this.outFrames.shift();
    let max = 0;
    for (const f of this.outFrames) if (f.t >= t - 0.15 && f.t <= t + 0.02 && f.rms > max) max = f.rms;
    return max;
  }

  private setPhase(p: RtPhase) {
    if (this.phase === p) return;
    this.phase = p;
    this.on.phase?.(p);
  }

  private send(e: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(e));
  }

  /** A real cut (new app turn, Send, Talk now, guard): drop her audio and any paused remainder. */
  private stopPlayback() {
    if (this.paused) {
      clearTimeout(this.paused.timer);
      this.paused = null;
    }
    this.listenOpen = false;
    this.hardStop();
    this.ledger.clear();
  }

  /** Stop what's scheduled now (the ledger and any pause are kept). */
  private hardStop() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    if (this.ctx) {
      this.nextTime = this.ctx.currentTime;
      const t = this.ctx.currentTime;
      this.outFrames = this.outFrames.filter((f) => f.t <= t);
    }
  }

  private play(pcm: Float32Array, rid = "", resumed = false) {
    const ctx = this.ctx;
    if (!ctx || !this.out || !pcm.length) return;
    // Her first ~1.5 s of each reply (and of a resume) can't be cut by barge-in.
    if (rid && (this.ledger.begin(rid) || (resumed && !this.sources.size))) this.gate.herAudioStarted(performance.now());
    const buf = ctx.createBuffer(1, pcm.length, RATE);
    buf.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    const at = Math.max(this.nextTime, ctx.currentTime + LEAD_S);
    for (let i = 0; i < pcm.length; i += 480) {
      let sum = 0;
      const end = Math.min(pcm.length, i + 480);
      for (let j = i; j < end; j++) sum += pcm[j]! * pcm[j]!;
      this.outFrames.push({ t: at + i / RATE, rms: Math.sqrt(sum / Math.max(1, end - i)) });
    }
    src.start(at);
    this.ledger.add(at, pcm, RATE);
    this.nextTime = at + buf.duration;
    this.sources.add(src);
    if (this.pendingE2E !== null) {
      const audibleAt = performance.now() + (at - ctx.currentTime) * 1000 + (ctx.outputLatency || 0) * 1000;
      const e2e = Math.round(audibleAt - this.pendingE2E);
      this.pendingE2E = null;
      this.on.metric?.({ e2eMs: e2e });
      this.send({ type: "rw.metric", e2e_ms: e2e });
    }
    src.onended = () => {
      this.sources.delete(src);
      // Paused for a possible barge-in: not idle (nothing queued may start yet).
      if (this.paused) return;
      if (!this.sources.size && this.gateDone) {
        this.stop();
        return;
      }
      if (!this.sources.size) {
        this.echoTailUntil = performance.now() + ECHO_TAIL_MS;
        if (!this.responding) {
          this.setPhase("listening");
          this.send({ type: "rw.idle" });
        }
      }
    };
    this.setPhase("speaking");
  }

  private onServer(e: Record<string, unknown>) {
    const type = String(e.type ?? "");
    switch (type) {
      case "session.ready":
        if (this.phase === "connecting") this.setPhase("listening");
        return;
      case "input_audio_buffer.speech_started": {
        if (this.paused) {
          // Already paused by the client gate: wait for the relay's verdict.
          this.setPhase("listening");
          return;
        }
        if (this.sources.size) {
          this.stopPlayback();
          this.send({ type: "response.cancel" });
          const now = performance.now();
          const barge = this.voiceOnsetAt ? Math.round(now - this.voiceOnsetAt) : null;
          if (barge !== null) {
            this.on.metric?.({ bargeMs: barge });
            this.send({ type: "rw.metric", barge_ms: barge });
          }
        }
        this.voiceOnsetAt = 0;
        this.setPhase("listening");
        return;
      }
      case "input_audio_buffer.speech_stopped":
        if (!this.paused) this.listenOpen = false;
        this.speechStoppedAt = performance.now();
        // End of speech = the last chunk with voice in it (before VAD's silence wait).
        this.pendingE2E = this.lastVoiceAt && this.speechStoppedAt - this.lastVoiceAt < 3000 ? this.lastVoiceAt : this.speechStoppedAt;
        this.setPhase("thinking");
        return;
      case "input_audio_buffer.committed":
        this.on.userCommitted?.(String(e.item_id ?? ""));
        return;
      case "conversation.item.input_audio_transcription.updated":
      case "conversation.item.input_audio_transcription.completed":
        this.on.userTranscript?.(String(e.item_id ?? ""), String(e.transcript ?? ""), type.endsWith("completed"));
        return;
      case "response.created":
        this.responding = true;
        this.respRid = String((e.response as { id?: string } | undefined)?.id ?? "") || null;
        this.gateHeard = true;
        return;
      case "response.output_audio.delta": {
        const rid = String(e.response_id ?? "");
        if (this.cancelled.has(rid)) return;
        const pcm = b64ToPcm(String(e.delta ?? ""));
        // The paused reply is still streaming in: keep it for a resume.
        if (this.paused && this.paused.rid === rid) {
          this.paused.remaining.push(pcm);
          return;
        }
        // The relay only lets a new reply through after a real barge-in.
        if (this.paused) this.onVerdict(true);
        this.play(pcm, rid);
        return;
      }
      case "response.output_audio_transcript.delta": {
        const rid = String(e.response_id ?? "");
        this.herText.set(rid, (this.herText.get(rid) ?? "") + String(e.delta ?? ""));
        if (this.herText.size > 8) this.herText.delete(this.herText.keys().next().value!);
        this.on.pauDelta?.(rid, String(e.delta ?? ""));
        return;
      }
      case "response.done": {
        this.responding = false;
        const r = e.response as { id?: string; status?: string } | undefined;
        this.on.pauDone?.(String(r?.id ?? ""), r?.status);
        if (!this.sources.size && !this.paused) {
          this.setPhase("listening");
          this.send({ type: "rw.idle" });
        }
        return;
      }
      case "rw.verdict":
        this.onVerdict(e.real === true, typeof e.response_id === "string" ? e.response_id : undefined);
        return;
      case "rw.drop": {
        // A reply that shouldn't be heard (noise turn, typed turn, repeat): never plays, playback untouched.
        const rid = String(e.response_id ?? "");
        this.cancelled.add(rid);
        this.on.pauDropped?.(rid);
        return;
      }
      case "rw.resume":
        this.resumeToken = String(e.resume ?? "") || null;
        return;
      case "rw.guard": {
        const rid = String(e.response_id ?? "");
        this.cancelled.add(rid);
        this.stopPlayback();
        this.on.pauCancelled?.(rid);
        return;
      }
      case "rw.tool":
        this.setPhase("thinking");
        return;
      case "rw.save_note": {
        const callId = String(e.call_id ?? "");
        const text = String(e.text ?? "");
        const run = this.on.saveNote ? this.on.saveNote(callId, text, String(e.item_id ?? ""), typeof e.kind === "string" ? e.kind : undefined) : Promise.resolve({ ok: false, result: "unsupported" });
        void run
          .catch(() => ({ ok: false, result: "error" }))
          .then((r) => this.send({ type: "rw.applied", call_id: callId, ok: r.ok, result: r.result, screen: (r as { screen?: string }).screen, spoken: (r as { spoken?: string }).spoken }));
        return;
      }
      case "rw.echo":
        this.on.echo?.(String(e.item_id ?? ""));
        return;
      case "rw.sources":
        this.on.sources?.((e.links as { title: string; url: string; why?: string }[]) ?? []);
        return;
      case "rw.gate_done":
        // The scripted gate line is out: hang up once it has finished playing.
        this.gateDone = true;
        if (!this.sources.size) this.stop();
        return;
      case "rw.rotate":
        this.resume = String(e.resume ?? "") || null;
        return;
      case "error": {
        const msg = String((e.error as { message?: string } | undefined)?.message ?? "");
        if (msg) console.warn("[pau realtime]", msg);
        return;
      }
    }
  }

  sendText(text: string) {
    this.reportCut(true);
    this.stopPlayback();
    this.speechStoppedAt = performance.now();
    this.pendingE2E = this.speechStoppedAt;
    this.send({ type: "rw.text", text });
    this.setPhase("thinking");
  }

  /** The app moved to a new scripted turn after a tap: she says it in her words. */
  sayTurn(text: string, opts: { detail?: boolean; spoken?: string } = {}) {
    // Stage 2+: the app moved on, so what she didn't get to say is superseded (truncate, no re-offer).
    // Stage 1 (a verbatim prompt): never cut her mid-sentence for it. The prompt queues behind
    // what she's saying (the relay holds it while she's generating; playback is sequential).
    if (!sayTurnWaits(opts)) {
      this.reportCut(false);
      this.stopPlayback();
    }
    this.pendingE2E = performance.now();
    this.send({ type: "rw.turn", text, ...(opts.detail ? { detail: true } : {}), ...(opts.spoken !== undefined ? { spoken: opts.spoken.slice(0, 1600) } : {}) });
  }

  /** What the app shows now and the choices waiting for a tap (data for her). */
  setScreen(text: string, choices: string[], followUp: boolean, spoken?: string) {
    this.screenMsg = { type: "rw.screen", text: text.slice(0, 800), choices: choices.slice(0, 6), followUp, ...(spoken !== undefined ? { spoken: spoken.slice(0, 1600) } : {}) };
    this.send(this.screenMsg);
  }

  /** Tell the relay how much of her reply was heard (it truncates her turn there). */
  private reportCut(reoffer: boolean) {
    if (!this.sources.size && !this.paused) return;
    const r = this.cutReport();
    if (!r.rid) return;
    this.send({ type: "rw.cut", response_id: r.rid, played_ms: r.playedMs, total_ms: r.totalMs, remainder: reoffer ? r.remainder.slice(0, 600) : "" });
  }

  interrupt() {
    this.reportCut(true);
    this.stopPlayback();
    this.send({ type: "response.cancel" });
    this.setPhase("listening");
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  /** 0..1 output loudness for the waves (real audio, not a timer). */
  level(): number {
    const a = this.analyser;
    if (!a || !this.sources.size) return 0;
    a.getByteTimeDomainData(this.levelBuf);
    let sum = 0;
    for (const v of this.levelBuf) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / this.levelBuf.length) * 4);
  }

  stop() {
    this.stopped = true;
    this.unsubTyping?.();
    this.unsubTyping = null;
    this.stopPlayback();
    try {
      this.ws?.close(1000);
    } catch {}
    this.ws = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
    this.setPhase("off");
  }
}
