"use client";

/**
 * Browser side of the Grok Voice realtime PoC. One AudioContext per call,
 * created inside the student's tap. Mic -> PCM16 24 kHz binary frames -> our
 * relay. Output deltas play gapless with a small lead; barge-in stops them.
 * The browser never holds an xAI key and never sends session config.
 */
export type RtPhase = "off" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export type RtEvents = {
  phase?: (p: RtPhase) => void;
  userTranscript?: (itemId: string, text: string, final: boolean) => void;
  userCommitted?: (itemId: string) => void;
  pauDelta?: (responseId: string, text: string) => void;
  pauDone?: (responseId: string, status: string | undefined) => void;
  pauCancelled?: (responseId: string) => void;
  saveNote?: (callId: string, text: string, itemId: string) => Promise<{ ok: boolean; result: string; screen?: string }>;
  sources?: (links: { title: string; url: string; why?: string }[]) => void;
  error?: (message: string) => void;
  metric?: (m: { e2eMs?: number; bargeMs?: number }) => void;
};

const RATE = 24_000;
const CHUNK = 2_400; // 100 ms
const LEAD_S = 0.06;
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

  constructor(
    private paperId: string,
    private on: RtEvents,
    private opts: { welcome: boolean; welcomeIndex: number; effort?: "none" | "high"; vad?: "client" | "server" },
  ) {}

  /** Call inside the tap. */
  async start(): Promise<void> {
    this.stopped = false;
    this.setPhase("connecting");
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
    if (this.resume) q.set("resume", this.resume);
    const ws = new WebSocket(`${proto}://${location.host}/api/voice/realtime?${q}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      for (const b of this.early.splice(0)) ws.send(b);
      if (!this.started) {
        this.started = true;
        ws.send(JSON.stringify({ type: "rw.start", welcome: this.opts.welcome, welcomeIndex: this.opts.welcomeIndex }));
      }
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
      this.voicedRun = 0;
      return;
    }
    // Local barge-in: stop her the moment the student talks over her (server VAD confirms later).
    const playing = this.sources.size > 0;
    this.voicedRun = playing && rms > 0.05 ? this.voicedRun + 1 : 0;
    if (playing && this.voicedRun >= 2) {
      this.voicedRun = 0;
      this.stopPlayback();
      this.send({ type: "response.cancel" });
      const barge = Math.round(now - (this.voiceOnsetAt || now) + 100);
      this.on.metric?.({ bargeMs: barge });
      this.send({ type: "rw.metric", barge_ms: barge });
      this.voiceOnsetAt = 0;
      this.setPhase("listening");
    }
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(pcm);
    else if (this.early.length < 80) this.early.push(pcm);
  }

  private setPhase(p: RtPhase) {
    if (this.phase === p) return;
    this.phase = p;
    this.on.phase?.(p);
  }

  private send(e: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(e));
  }

  private stopPlayback() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    if (this.ctx) this.nextTime = this.ctx.currentTime;
  }

  private play(pcm: Float32Array) {
    const ctx = this.ctx;
    if (!ctx || !this.out || !pcm.length) return;
    const buf = ctx.createBuffer(1, pcm.length, RATE);
    buf.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    const at = Math.max(this.nextTime, ctx.currentTime + LEAD_S);
    src.start(at);
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
      if (!this.sources.size) {
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
        return;
      case "response.output_audio.delta": {
        const rid = String(e.response_id ?? "");
        if (this.cancelled.has(rid)) return;
        this.play(b64ToPcm(String(e.delta ?? "")));
        return;
      }
      case "response.output_audio_transcript.delta":
        this.on.pauDelta?.(String(e.response_id ?? ""), String(e.delta ?? ""));
        return;
      case "response.done": {
        this.responding = false;
        const r = e.response as { id?: string; status?: string } | undefined;
        this.on.pauDone?.(String(r?.id ?? ""), r?.status);
        if (!this.sources.size) {
          this.setPhase("listening");
          this.send({ type: "rw.idle" });
        }
        return;
      }
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
        const run = this.on.saveNote ? this.on.saveNote(callId, text, String(e.item_id ?? "")) : Promise.resolve({ ok: false, result: "unsupported" });
        void run
          .catch(() => ({ ok: false, result: "error" }))
          .then((r) => this.send({ type: "rw.applied", call_id: callId, ok: r.ok, result: r.result, screen: (r as { screen?: string }).screen }));
        return;
      }
      case "rw.sources":
        this.on.sources?.((e.links as { title: string; url: string; why?: string }[]) ?? []);
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
    this.stopPlayback();
    this.speechStoppedAt = performance.now();
    this.pendingE2E = this.speechStoppedAt;
    this.send({ type: "rw.text", text });
    this.setPhase("thinking");
  }

  /** The app moved to a new scripted turn after a tap: she says it in her words. */
  sayTurn(text: string) {
    this.stopPlayback();
    this.pendingE2E = performance.now();
    this.send({ type: "rw.turn", text });
  }

  interrupt() {
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
