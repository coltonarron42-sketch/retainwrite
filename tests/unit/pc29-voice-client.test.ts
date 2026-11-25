/**
 * PC-29: the browser client's barge-in pause / resume and typing pause, with a
 * fake AudioContext and socket (no real audio). Drives the private handlers the
 * worklet and relay would call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeVoice } from "@/lib/voice/realtime/client";
import { typingArbiter } from "@/lib/voice/realtime/arbiter";
import { TURN_TUNING } from "@/lib/voice/realtime/turns";

class FakeSrc {
  buffer: { duration: number; length: number } | null = null;
  onended: (() => void) | null = null;
  startedAt = -1;
  stopped = false;
  connect() {}
  start(at: number) {
    this.startedAt = at;
  }
  stop() {
    this.stopped = true;
  }
}
class FakeCtx {
  currentTime = 0;
  outputLatency = 0;
  srcs: FakeSrc[] = [];
  createBuffer(_c: number, length: number, rate: number) {
    return { duration: length / rate, length, copyToChannel() {} };
  }
  createBufferSource() {
    const s = new FakeSrc();
    this.srcs.push(s);
    return s;
  }
}

const sent: Record<string, unknown>[] = [];
const audioUp: number[] = [];
let clock = 10_000;

function voice() {
  const v = new RealtimeVoice("p", {}, { welcome: false, welcomeIndex: 0, stage: 1 });
  const ctx = new FakeCtx();
  const any = v as unknown as Record<string, unknown> & {
    onMic: (pcm: ArrayBuffer, rms: number) => void;
    onServer: (e: Record<string, unknown>) => void;
    sources: Set<unknown>;
  };
  any.ctx = ctx;
  any.out = { connect() {} };
  any.ws = {
    readyState: 1,
    send: (d: string | ArrayBuffer) => {
      if (typeof d === "string") sent.push(JSON.parse(d));
      else audioUp.push(new Int16Array(d).some((x) => x !== 0) ? 1 : 0);
    },
  };
  return { v, any, ctx };
}
/** 100 ms of her audio, base64 PCM16 (non-zero). */
const herChunk = () => Buffer.from(new Int16Array(2400).fill(1000).buffer).toString("base64");
const micFrame = () => new Int16Array(2400).fill(500).buffer;

beforeEach(() => {
  sent.length = 0;
  audioUp.length = 0;
  clock = 10_000;
  vi.stubGlobal("WebSocket", { OPEN: 1, CONNECTING: 0 });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  typingArbiter._reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("client barge-in: pause, then resume or drop", () => {
  it("noise over her pauses her line and resumes from the exact spot (nothing lost, nothing repeated)", () => {
    const { any, ctx } = voice();
    any.onServer({ type: "response.created", response: { id: "r1" } });
    any.onServer({ type: "response.output_audio_transcript.delta", response_id: "r1", delta: "one two three four five six seven eight nine ten" });
    for (let i = 0; i < 30; i++) any.onServer({ type: "response.output_audio.delta", response_id: "r1", delta: herChunk() }); // 3 s
    any.onServer({ type: "response.done", response: { id: "r1", status: "completed" } });
    // Grace: loud room noise in her first 1.5 s never cuts her.
    for (let i = 0; i < 14; i++) {
      clock += 100;
      ctx.currentTime += 0.1;
      any.onMic(micFrame(), 0.3);
    }
    expect(sent.some((e) => e.type === "rw.barge")).toBe(false);
    expect(audioUp.every((x) => x === 0)).toBe(true);
    // A short blip after grace: still nothing.
    clock += 100;
    ctx.currentTime += 0.1;
    any.onMic(micFrame(), 0.01);
    clock += 100;
    ctx.currentTime += 0.1;
    any.onMic(micFrame(), 0.01);
    expect(sent.some((e) => e.type === "rw.barge")).toBe(false);
    // Sustained sound (>= sustainMs) at ~1.6 s in: pause and report how much she got out.
    for (let i = 0; i < Math.ceil(TURN_TUNING.sustainMs / TURN_TUNING.frameMs); i++) {
      clock += 100;
      ctx.currentTime += 0.1;
      any.onMic(micFrame(), 0.3);
    }
    const barge = sent.find((e) => e.type === "rw.barge") as { played_ms: number; total_ms: number; remainder: string; response_id: string };
    expect(barge).toBeTruthy();
    expect(barge.response_id).toBe("r1");
    expect(barge.total_ms).toBe(3000);
    expect(barge.played_ms).toBeGreaterThan(2000);
    expect(barge.remainder.split(" ").length).toBeLessThan(10);
    expect(any.sources.size).toBe(0);
    // The rolled-back audio went up so the server can hear the words.
    expect(audioUp.filter((x) => x === 1).length).toBeGreaterThanOrEqual(5);
    // Relay: it was noise. She carries on with only the unplayed part.
    const before = ctx.srcs.length;
    any.onServer({ type: "rw.verdict", real: false, response_id: "r1" });
    const resumed = ctx.srcs.slice(before);
    const resumedMs = resumed.reduce((s, x) => s + (x.buffer!.duration * 1000), 0);
    expect(Math.round(resumedMs)).toBe(3000 - barge.played_ms);
    expect(sent.filter((e) => e.type === "response.cancel")).toHaveLength(0);
  });

  it("real words over her drop the rest locally (the relay re-offers the point after answering)", () => {
    const { any, ctx } = voice();
    any.onServer({ type: "response.created", response: { id: "r1" } });
    for (let i = 0; i < 30; i++) any.onServer({ type: "response.output_audio.delta", response_id: "r1", delta: herChunk() });
    clock += 2000;
    ctx.currentTime += 2;
    for (let i = 0; i < Math.ceil(TURN_TUNING.sustainMs / TURN_TUNING.frameMs); i++) {
      clock += 100;
      any.onMic(micFrame(), 0.3);
    }
    expect(sent.some((e) => e.type === "rw.barge")).toBe(true);
    const n = ctx.srcs.length;
    any.onServer({ type: "rw.verdict", real: true, response_id: "r1" });
    // Late audio of the cut reply never plays; her answer (a new reply) does.
    any.onServer({ type: "response.output_audio.delta", response_id: "r1", delta: herChunk() });
    expect(ctx.srcs.length).toBe(n);
    any.onServer({ type: "response.created", response: { id: "r2" } });
    any.onServer({ type: "response.output_audio.delta", response_id: "r2", delta: herChunk() });
    expect(ctx.srcs.length).toBe(n + 1);
  });

  it("a dropped reply (noise turn / typed turn / repeat) never plays and doesn't stop what's playing", () => {
    const { any, ctx } = voice();
    any.onServer({ type: "response.output_audio.delta", response_id: "r1", delta: herChunk() });
    any.onServer({ type: "rw.drop", response_id: "r2" });
    any.onServer({ type: "response.output_audio.delta", response_id: "r2", delta: herChunk() });
    expect(ctx.srcs).toHaveLength(1);
    expect(ctx.srcs[0]!.stopped).toBe(false);
  });
});

describe("client: typing pauses the mic", () => {
  it("sends silence while typing (even loud talk over her), and tells the relay", () => {
    const { v, any, ctx } = voice();
    (v as unknown as { unsubTyping: () => void }).unsubTyping = typingArbiter.subscribe((t) => (any.setTyping as (t: boolean) => void).call(v, t));
    any.onServer({ type: "response.output_audio.delta", response_id: "r1", delta: herChunk() });
    typingArbiter.focus(false);
    typingArbiter.key(true);
    expect(sent.some((e) => e.type === "rw.typing" && e.on === true)).toBe(true);
    clock += TURN_TUNING.graceMs + 100;
    for (let i = 0; i < 10; i++) {
      clock += 100;
      ctx.currentTime += 0.1;
      any.onMic(micFrame(), 0.4);
    }
    expect(sent.some((e) => e.type === "rw.barge")).toBe(false);
    expect(audioUp.every((x) => x === 0)).toBe(true);
    typingArbiter.blur();
    expect(sent.some((e) => e.type === "rw.typing" && e.on === false)).toBe(true);
  });
});
