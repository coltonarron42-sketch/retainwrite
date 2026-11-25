/**
 * PC-29c: "Pau still cut herself off at times" (prod, 2026-11-25 ~12:01 MT, session 46754318:
 * questionsCut 3, truncated 4, bargeIn/bargeReal/bargeNoise all 0). The cutoffs were the
 * Stage 1 question gate ending her reply at an off-screen question, mid-explanation and on a
 * chars x ms guess. Now the stray question is lifted out at real pauses and the rest plays;
 * and a new Stage 1 prompt queues behind her instead of stopping her playback.
 */
import { afterAll, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runRelay } from "@/lib/voice/realtime/relay";
import { frameRms, QGATE_TUNING, quietCutPoint, sayTurnWaits, textWithout } from "@/lib/voice/realtime/turns";

const RATE = 24000;
/** Speech-ish PCM: `ms` of tone with short gaps between "words" every 300 ms (unless gaps=false). */
function speech(ms: number, gaps = true): Buffer {
  const n = Math.round((RATE * ms) / 1000);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = (i / RATE) * 1000;
    const inGap = gaps && t % 300 >= 250 && t % 300 < 310 && ms - t > 100;
    b.writeInt16LE(inGap ? 0 : Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / RATE)), i * 2);
  }
  return b;
}
const silence = (ms: number) => Buffer.alloc(Math.round((RATE * ms) / 1000) * 2);
const loud = (b: Buffer) => {
  let n = 0;
  for (let i = 0; i + 1 < b.length; i += 2) if (Math.abs(b.readInt16LE(i)) > 1500) n++;
  return n;
};

describe("quiet cut points", () => {
  const pcm = Buffer.concat([speech(2900), silence(400), speech(2000)]);
  it("moves a guessed boundary onto the real pause between sentences", () => {
    const at = quietCutPoint(pcm, RATE, 3500, 2900, 4200);
    expect(at).toBeGreaterThan(2900);
    expect(at).toBeLessThan(3300);
    // From the other side too.
    const at2 = quietCutPoint(pcm, RATE, 2600, 2000, 3300);
    expect(at2).toBeGreaterThan(2900);
    expect(at2).toBeLessThan(3300);
  });
  it("prefers a sentence pause over a nearer gap between words", () => {
    const at = quietCutPoint(pcm, RATE, 2560, 2000, 3600);
    expect(at).toBeGreaterThan(2900);
  });
  it("falls back to a word gap, then to the guess, never inside a word when there's quiet", () => {
    const words = speech(3000);
    const at = quietCutPoint(words, RATE, 1400, 1000, 1800);
    const f = Math.floor(at / QGATE_TUNING.frameMs);
    expect(frameRms(words, RATE)[f]!).toBeLessThan(500);
    expect(quietCutPoint(speech(3000, false), RATE, 1400, 1000, 1800)).toBe(1400);
  });
  it("text without the lifted-out question", () => {
    const t = "Okay, here's the gist. Want me to go slower? The first one says leaders adapt.";
    expect(textWithout(t, [{ from: 22, to: 44 }])).toBe("Okay, here's the gist. The first one says leaders adapt.");
    expect(textWithout(t, [{ from: 44, to: t.length }])).toBe("Okay, here's the gist. Want me to go slower?");
  });
  it("a Stage 1 prompt waits for her; a Stage 2 turn still supersedes her", () => {
    expect(sayTurnWaits({ spoken: "Who fits your pick best?" })).toBe(true);
    expect(sayTurnWaits({ spoken: "" })).toBe(true);
    expect(sayTurnWaits({})).toBe(false);
  });
});

/* ------------------------- scripted relay sessions ------------------------- */

const fakeDb = (() => {
  const chain: Record<string, unknown> = {};
  const fn = () => chain;
  Object.assign(chain, { from: fn, select: fn, eq: fn, order: fn, limit: fn, maybeSingle: async () => ({ data: null }) });
  return chain as unknown as SupabaseClient;
})();
type Ev = Record<string, unknown>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("relay: a stray question is lifted out, she keeps talking", () => {
  let upstream: Ev[] = [];
  let upSock: WebSocket | null = null;
  const xai = new WebSocketServer({ port: 0 });
  xai.on("connection", (ws) => {
    upSock = ws;
    upstream = [];
    ws.on("message", (d, bin) => !bin && upstream.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: "session.created" }));
    ws.send(JSON.stringify({ type: "conversation.created", conversation: { id: "conv_pc29c" } }));
  });
  const front = new WebSocketServer({ port: 0 });
  front.on("connection", (client) => {
    void runRelay({ client, supabase: fakeDb, userId: "u", paperId: "00000000-0000-4000-8000-000000000000", apiKey: "k", resumeToken: null, effort: "none", vad: "server", stage: 1 });
  });
  afterAll(() => {
    xai.close();
    front.close();
  });

  async function session(spoken: string) {
    process.env.RW_REALTIME_TEST_URL = `ws://127.0.0.1:${(xai.address() as { port: number }).port}/?model=x`;
    const got: Ev[] = [];
    const c = new WebSocket(`ws://127.0.0.1:${(front.address() as { port: number }).port}`);
    c.on("message", (d) => got.push(JSON.parse(d.toString()) as Ev));
    await new Promise((r) => c.on("open", r));
    await wait(200);
    const up = (e: Ev) => upSock!.send(JSON.stringify(e));
    c.send(JSON.stringify({ type: "rw.screen", text: "Question on screen", choices: [], spoken }));
    await wait(30);
    return { c, got, up };
  }
  /** Stream a reply: each [text, pcm] sentence's words, then its audio in 100 ms chunks. */
  function stream(up: (e: Ev) => void, rid: string, parts: [string, Buffer][]) {
    up({ type: "response.created", response: { id: rid } });
    up({ type: "response.output_item.added", response_id: rid, item: { id: `m_${rid}`, type: "message" } });
    for (const [text, pcm] of parts) {
      up({ type: "response.output_audio_transcript.delta", response_id: rid, delta: text });
      for (let o = 0; o < pcm.length; o += 4800) up({ type: "response.output_audio.delta", response_id: rid, delta: pcm.subarray(o, o + 4800).toString("base64") });
    }
    const full = parts.map((p) => p[0]).join("");
    up({ type: "response.output_audio_transcript.done", response_id: rid, transcript: full });
    up({ type: "response.done", response: { id: rid, status: "completed" } });
  }
  const heard = (got: Ev[], rid: string) =>
    Buffer.concat(got.filter((e) => e.type === "response.output_audio.delta" && e.response_id === rid).map((e) => Buffer.from(String(e.delta), "base64")));

  // ~50 chars ≈ 3.1 s at the starting 62 ms/char guess; the real pause sits at 2.9-3.3 s.
  const s1: [string, Buffer] = ["Okay, so here's the gist of each reading for you. ", Buffer.concat([speech(2900), silence(400)])];
  const q: [string, Buffer] = ["Want me to go slower on any of them at all? ", Buffer.concat([speech(2300), silence(400)])];
  const s3: [string, Buffer] = ["The first one says leaders adapt to the people they lead.", speech(3400)];

  it("a question in the middle: lifted out at the pauses, the explanation after it still plays, no truncate", async () => {
    const { c, got, up } = await session("Where are you with it?");
    stream(up, "rMid", [s1, q, s3]);
    await wait(250);
    const out = heard(got, "rMid");
    // Every word of the two statements, none of the question.
    expect(loud(out)).toBe(loud(s1[1]) + loud(s3[1]));
    const done = got.find((e) => e.type === "response.output_audio_transcript.done" && e.response_id === "rMid");
    expect(done?.transcript).toBe("Okay, so here's the gist of each reading for you. The first one says leaders adapt to the people they lead.");
    const shown = got.filter((e) => e.type === "response.output_audio_transcript.delta" && e.response_id === "rMid").map((e) => e.delta).join("");
    expect(shown).not.toContain("slower");
    expect(shown).toContain("leaders adapt");
    expect(upstream.filter((e) => e.type === "conversation.item.truncate")).toHaveLength(0);
    c.close();
  });

  it("a question at the end: she stops at the pause before it, and xAI's copy ends there", async () => {
    const { c, got, up } = await session("Where are you with it?");
    stream(up, "rEnd", [s1, ["Which one do you want to start with?", speech(2200)]]);
    await wait(250);
    const out = heard(got, "rEnd");
    expect(loud(out)).toBe(loud(s1[1]));
    const tr = upstream.find((e) => e.type === "conversation.item.truncate") as { audio_end_ms: number } | undefined;
    expect(tr?.audio_end_ms).toBeGreaterThan(2900);
    expect(tr!.audio_end_ms).toBeLessThan(3300);
    c.close();
  });

  it("no stray question: every bit of her reply plays", async () => {
    const { c, got, up } = await session("Where are you with it?");
    stream(up, "rAll", [s1, s3]);
    await wait(250);
    expect(heard(got, "rAll").length).toBe(s1[1].length + s3[1].length);
    c.close();
  });
});
