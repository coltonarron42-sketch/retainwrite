/**
 * PC-29 (Colton t194u): barge-in sensitivity, resume after a cut, one input
 * channel at a time, and no repeats on the Grok Voice call. Pure helpers plus
 * scripted relay sessions (fake xAI socket, injected noise-only VAD turns,
 * typing during speech).
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runRelay } from "@/lib/voice/realtime/relay";
import { BargeGate, PlaybackLedger, TURN_TUNING, isNoiseTurn, isRepeat, overlap, typingActive, unplayedRemainder } from "@/lib/voice/realtime/turns";
import { typingArbiter } from "@/lib/voice/realtime/arbiter";
import { buildStage1Instructions, buildInstructions } from "@/lib/voice/realtime/persona";

const F = TURN_TUNING.frameMs;

describe("BargeGate: talking over her", () => {
  const frame = (g: BargeGate, now: number, rms: number, extra: Partial<{ guarded: boolean; playing: boolean; herOutRms: number; coupling: number }> = {}) =>
    g.frame({ now, rms, guarded: true, playing: true, herOutRms: 0.1, coupling: 0.1, ...extra });

  it("passes the mic straight through when she isn't talking", () => {
    const g = new BargeGate();
    expect(frame(g, 0, 0.5, { guarded: false, playing: false })).toBe("pass");
  });

  it("mutes barge-in for the first 1.5 s of her reply, then needs >= 500 ms of sustained voice", () => {
    const g = new BargeGate();
    g.herAudioStarted(1000);
    // Loud talk from the start: held through the grace window.
    let t = 1000;
    for (; t < 1000 + TURN_TUNING.graceMs; t += F) expect(frame(g, t, 0.3)).toBe("hold");
    // Grace works like a mute: after it, a fresh 500 ms of talk is needed.
    for (let i = 0; i < 4; i++, t += F) expect(frame(g, t, 0.3)).toBe("hold");
    expect(frame(g, t, 0.3)).toBe("barge");
  });

  it("noise blips (a cough, a door, keys) never barge", () => {
    const g = new BargeGate();
    g.herAudioStarted(1);
    const t0 = TURN_TUNING.graceMs + 100;
    // Blips up to 400 ms with real gaps between them (4+ quiet frames).
    const q = [0.01, 0.01, 0.01, 0.01];
    const pattern = [0.3, 0.3, ...q, 0.3, ...q, 0.3, 0.3, 0.3, 0.3, ...q, 0.2, ...q];
    pattern.forEach((rms, i) => expect(frame(g, t0 + i * F, rms)).toBe("hold"));
  });

  it("short pauses between words don't reset a real interruption", () => {
    const g = new BargeGate();
    g.herAudioStarted(1);
    const t0 = TURN_TUNING.graceMs + 100;
    const out = [0.2, 0.2, 0.01, 0.01, 0.2, 0.2, 0.2].map((rms, i) => frame(g, t0 + i * F, rms));
    expect(out.slice(0, 6)).toEqual(["hold", "hold", "hold", "hold", "hold", "hold"]);
    expect(out[6]).toBe("barge");
  });

  it("a short spoken interrupt with a word gap (recorded \"wait, hold on\" frame RMS) barges", () => {
    const g = new BargeGate();
    g.herAudioStarted(1);
    const t0 = TURN_TUNING.graceMs + 100;
    const clip = [0.0, 0.074, 0.105, 0.022, 0.0, 0.004, 0.157, 0.118, 0.052, 0.048, 0.034, 0.013, 0.0];
    const out = clip.map((rms, i) => frame(g, t0 + i * F, rms));
    expect(out.indexOf("barge")).toBe(8);
  });

  it("a quiet talker (~0.05 RMS, phone at arm's length) can still interrupt", () => {
    const g = new BargeGate();
    g.herAudioStarted(1);
    const t0 = TURN_TUNING.graceMs + 100;
    const out = [0.05, 0.05, 0.05, 0.05, 0.05].map((rms, i) => frame(g, t0 + i * F, rms, { herOutRms: 0.1, coupling: 0.05 }));
    expect(out[4]).toBe("barge");
  });

  it("her own echo (loud speakers) isn't the student: the bar rises with her output", () => {
    const g = new BargeGate();
    expect(g.threshold(0.3, 0.5, true)).toBeCloseTo(0.45);
    expect(g.threshold(0.0, 1, true)).toBe(TURN_TUNING.guardFloorRms);
    g.herAudioStarted(1);
    const t0 = TURN_TUNING.graceMs + 100;
    for (let i = 0; i < 10; i++) expect(frame(g, t0 + i * F, 0.4, { herOutRms: 0.3, coupling: 0.5 })).toBe("hold");
  });

  it("their words that started over her tail are flushed when her turn ends", () => {
    const g = new BargeGate();
    g.herAudioStarted(1);
    const t0 = TURN_TUNING.graceMs + 100;
    expect(frame(g, t0, 0.2)).toBe("hold");
    expect(frame(g, t0 + F, 0.2, { guarded: false, playing: false })).toBe("flush");
    expect(frame(g, t0 + 2 * F, 0.2, { guarded: false, playing: false })).toBe("pass");
  });
});

describe("noise turns, repeats, remainders", () => {
  it("filler or empty is always noise; over her, lone non-interrupt words and ASR hallucinations are noise too", () => {
    expect(isNoiseTurn("", false)).toBe(true);
    expect(isNoiseTurn("Um... uh, hmm.", false)).toBe(true);
    expect(isNoiseTurn("Thank you.", true)).toBe(true);
    expect(isNoiseTurn("the", true)).toBe(true);
    expect(isNoiseTurn("Wait!", true)).toBe(false);
    expect(isNoiseTurn("Pau, hold on", true)).toBe(false);
    expect(isNoiseTurn("what does that mean", true)).toBe(false);
    expect(isNoiseTurn("Thank you.", false)).toBe(false);
    expect(isNoiseTurn("sleep", false)).toBe(false);
  });

  it("flags a line that repeats one she just said, not a new one", () => {
    const last = "Nice, that's a real reason. What's one example from the reading that shows it?";
    expect(isRepeat("Nice, that's a real reason. What's one example from the reading", [last])).toBe(true);
    expect(isRepeat("Okay, so tell me who your audience is for this one", [last])).toBe(false);
    expect(isRepeat("Nice, that's", [last])).toBe(false);
    expect(overlap("a b c d", "x y z")).toBe(0);
  });

  it("the unheard remainder is word-aligned to how much audio played", () => {
    const t = "one two three four five six seven eight nine ten";
    expect(unplayedRemainder(t, 0, 1000)).toBe(t);
    expect(unplayedRemainder(t, 500, 1000)).toBe("six seven eight nine ten");
    expect(unplayedRemainder(t, 990, 1000)).toBe("");
  });

  it("the playback ledger knows what played and resumes from the same sample", () => {
    const rate = 1000;
    const l = new PlaybackLedger();
    expect(l.begin("r1")).toBe(true);
    expect(l.begin("r1")).toBe(false);
    l.add(10, new Float32Array(1000).fill(0.1), rate); // 10.0 -> 11.0 s
    l.add(11, new Float32Array(1000).fill(0.2), rate); // 11.0 -> 12.0 s
    expect(l.totalMs()).toBe(2000);
    expect(l.playedMs(10.5)).toBe(500);
    const rest = l.remainingPcm(10.5, rate);
    expect(rest.map((c) => c.length)).toEqual([500, 1000]);
    l.rebase(500);
    expect(l.playedMs(0)).toBe(500);
    l.add(20, rest[0]!, rate);
    l.add(20.5, rest[1]!, rate);
    expect(l.totalMs()).toBe(2000);
    expect(l.playedMs(21)).toBe(1500);
  });
});

describe("one input channel at a time", () => {
  beforeEach(() => typingArbiter._reset());

  it("typing = focused composer with text or a recent keystroke; a typed prompt needs only focus", () => {
    expect(typingActive({ focused: false, lastKeyAt: 100, hasText: true, typedPrompt: true }, 200)).toBe(false);
    expect(typingActive({ focused: true, lastKeyAt: 0, hasText: true, typedPrompt: false }, 200)).toBe(true);
    expect(typingActive({ focused: true, lastKeyAt: 100, hasText: false, typedPrompt: false }, 200)).toBe(true);
    expect(typingActive({ focused: true, lastKeyAt: 100, hasText: false, typedPrompt: false }, 100 + TURN_TUNING.typingIdleMs + 1)).toBe(false);
    expect(typingActive({ focused: true, lastKeyAt: 0, hasText: false, typedPrompt: true }, 200)).toBe(true);
  });

  it("the arbiter tells the call when typing starts and stops", () => {
    const seen: boolean[] = [];
    const off = typingArbiter.subscribe((t) => seen.push(t));
    typingArbiter.focus(false);
    typingArbiter.key(true);
    expect(typingArbiter.isTyping()).toBe(true);
    typingArbiter.sent();
    typingArbiter.blur();
    expect(typingArbiter.isTyping()).toBe(false);
    typingArbiter.setTypedPrompt(true);
    typingArbiter.focus(false);
    expect(typingArbiter.isTyping()).toBe(true);
    typingArbiter.blur();
    off();
    expect(seen).toEqual([true, false, true, false]);
  });
});

describe("persona: variety and conversation flow", () => {
  it("every stage carries the Variety rule and her last lines", () => {
    const s1 = buildStage1Instructions("state", [], ["Got it. What's the one thing your teacher wants most?"]);
    expect(s1).toMatch(/Variety: never say the same sentence/);
    expect(s1).toContain("Your last lines this call");
    expect(s1).toContain("What's the one thing your teacher wants most?");
    expect(buildInstructions("state")).toMatch(/isn't a turn/);
    expect(buildInstructions("state")).not.toContain("Your last lines this call");
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

describe("relay turn-taking (scripted xAI events)", () => {
  let upstream: Ev[] = [];
  let upSock: WebSocket | null = null;
  const xai = new WebSocketServer({ port: 0 });
  xai.on("connection", (ws) => {
    upSock = ws;
    upstream = [];
    ws.on("message", (d, bin) => !bin && upstream.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: "session.created" }));
    ws.send(JSON.stringify({ type: "conversation.created", conversation: { id: "conv_pc29" } }));
  });
  const front = new WebSocketServer({ port: 0 });
  front.on("connection", (client) => {
    void runRelay({ client, supabase: fakeDb, userId: "u", paperId: "00000000-0000-4000-8000-000000000000", apiKey: "k", resumeToken: null, effort: "none", vad: "server", stage: 1 });
  });
  afterAll(() => {
    xai.close();
    front.close();
  });

  async function session() {
    process.env.RW_REALTIME_TEST_URL = `ws://127.0.0.1:${(xai.address() as { port: number }).port}/?model=x`;
    const got: Ev[] = [];
    const c = new WebSocket(`ws://127.0.0.1:${(front.address() as { port: number }).port}`);
    c.on("message", (d) => {
      const e = JSON.parse(d.toString()) as Ev;
      got.push(e);
      if (e.type === "rw.save_note") c.send(JSON.stringify({ type: "rw.applied", call_id: e.call_id, ok: true, result: "in_box" }));
    });
    await new Promise((r) => c.on("open", r));
    await wait(200);
    const up = (e: Ev) => upSock!.send(JSON.stringify(e));
    const send = (e: Ev) => c.send(JSON.stringify(e));
    // Her reply r1 with a known assistant item id, fully streamed.
    const herLine = (rid: string, text: string, item = `m_${rid}`) => {
      up({ type: "response.created", response: { id: rid } });
      up({ type: "response.output_item.added", response_id: rid, item: { id: item, type: "message" } });
      up({ type: "response.output_audio_transcript.delta", response_id: rid, delta: text });
      up({ type: "response.output_audio.delta", response_id: rid, delta: "AAAA" });
      up({ type: "response.done", response: { id: rid, status: "completed" } });
    };
    return { c, got, up, send, herLine };
  }

  it("gives the browser a resume token so a glitch can reconnect without losing the conversation", async () => {
    const { c, got } = await session();
    expect(got.some((e) => e.type === "rw.resume" && typeof e.resume === "string")).toBe(true);
    c.close();
  });

  it("a noise-only turn (server VAD fired on room noise) gets no reply at all", async () => {
    const { c, got, up } = await session();
    up({ type: "input_audio_buffer.speech_started" });
    up({ type: "input_audio_buffer.speech_stopped" });
    up({ type: "input_audio_buffer.committed", item_id: "n1" });
    up({ type: "response.created", response: { id: "rN" } });
    up({ type: "response.output_audio.delta", response_id: "rN", delta: "AAAA" });
    up({ type: "response.output_audio_transcript.delta", response_id: "rN", delta: "Sorry, I didn't catch that." });
    await wait(80);
    // Held while the words are unknown.
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rN")).toBe(false);
    up({ type: "conversation.item.input_audio_transcription.completed", item_id: "n1", transcript: "Hmm." });
    await wait(120);
    expect(got.some((e) => e.type === "rw.drop" && e.response_id === "rN" && e.reason === "noise")).toBe(true);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rN")).toBe(false);
    expect(upstream.some((e) => e.type === "response.cancel")).toBe(true);
    // Nothing went into their answer box.
    await wait(350);
    expect(got.some((e) => e.type === "rw.save_note" && e.item_id === "n1")).toBe(false);
    c.close();
  });

  it("a real turn's reply is released as soon as their words show up", async () => {
    const { c, got, up } = await session();
    up({ type: "input_audio_buffer.committed", item_id: "w1" });
    up({ type: "response.created", response: { id: "rW" } });
    up({ type: "response.output_audio.delta", response_id: "rW", delta: "AAAA" });
    up({ type: "conversation.item.input_audio_transcription.updated", item_id: "w1", transcript: "I think the reading says" });
    await wait(100);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rW")).toBe(true);
    c.close();
  });

  it("a false barge-in (noise over her) resumes her line: no truncate, no new reply", async () => {
    const { c, got, up, send, herLine } = await session();
    herLine("r1", "So the prompt wants one clear claim about school start times and two reasons. What's your first reason?");
    await wait(80);
    send({ type: "rw.barge", response_id: "r1", played_ms: 1200, total_ms: 5000, remainder: "and two reasons. What's your first reason?" });
    await wait(30);
    up({ type: "input_audio_buffer.speech_started" });
    up({ type: "input_audio_buffer.speech_stopped" });
    up({ type: "input_audio_buffer.committed", item_id: "b1" });
    up({ type: "response.created", response: { id: "r2" } });
    up({ type: "conversation.item.input_audio_transcription.updated", item_id: "b1", transcript: "Thank you." });
    up({ type: "response.output_audio.delta", response_id: "r2", delta: "AAAA" });
    up({ type: "conversation.item.input_audio_transcription.completed", item_id: "b1", transcript: "Thank you." });
    await wait(150);
    expect(got.some((e) => e.type === "rw.verdict" && e.real === false && e.response_id === "r1")).toBe(true);
    expect(got.some((e) => e.type === "rw.drop" && e.response_id === "r2")).toBe(true);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "r2")).toBe(false);
    expect(upstream.some((e) => e.type === "conversation.item.truncate")).toBe(false);
    c.close();
  });

  it("a pause the server never hears as speech resumes her within ~1.2 s", async () => {
    const { c, got, send, herLine } = await session();
    herLine("r1", "So the prompt wants one clear claim and two reasons. What's your first reason?");
    await wait(60);
    send({ type: "rw.barge", response_id: "r1", played_ms: 900, total_ms: 4000, remainder: "two reasons. What's your first reason?" });
    await wait(TURN_TUNING.verdictTimeoutMs - 300);
    expect(got.some((e) => e.type === "rw.verdict")).toBe(false);
    await wait(500);
    expect(got.some((e) => e.type === "rw.verdict" && e.real === false && e.response_id === "r1")).toBe(true);
    c.close();
  });

  it("a real barge-in truncates her turn where it was heard and keeps the unheard point for after the answer", async () => {
    const { c, got, up, send, herLine } = await session();
    herLine("r1", "So the prompt wants one clear claim about school start times and two reasons. What's your first reason?");
    await wait(80);
    send({ type: "rw.barge", response_id: "r1", played_ms: 1800, total_ms: 5000, remainder: "and two reasons. What's your first reason?" });
    await wait(30);
    up({ type: "input_audio_buffer.speech_started" });
    up({ type: "conversation.item.input_audio_transcription.updated", item_id: "b2", transcript: "wait what counts as a reason" });
    up({ type: "input_audio_buffer.committed", item_id: "b2" });
    up({ type: "conversation.item.input_audio_transcription.updated", item_id: "b2", transcript: "wait what counts as a reason" });
    await wait(150);
    expect(got.some((e) => e.type === "rw.verdict" && e.real === true)).toBe(true);
    const tr = upstream.find((e) => e.type === "conversation.item.truncate");
    expect(tr).toMatchObject({ item_id: "m_r1", content_index: 0, audio_end_ms: 1800 });
    const su = upstream.filter((e) => e.type === "session.update").at(-1) as { session: { instructions: string } };
    expect(su.session.instructions).toContain("never heard the end of it");
    expect(su.session.instructions).toContain("What's your first reason?");
    // Her answer to them plays normally.
    up({ type: "response.created", response: { id: "r3" } });
    up({ type: "response.output_audio.delta", response_id: "r3", delta: "AAAA" });
    await wait(80);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "r3")).toBe(true);
    c.close();
  });

  it("talk that ends while they're typing gets no spoken reply; their words still go to the box", async () => {
    const { c, got, up, send } = await session();
    send({ type: "rw.typing", on: true });
    await wait(30);
    up({ type: "input_audio_buffer.committed", item_id: "t1" });
    up({ type: "conversation.item.input_audio_transcription.completed", item_id: "t1", transcript: "because teens sleep later" });
    up({ type: "response.created", response: { id: "rT" } });
    up({ type: "response.output_audio.delta", response_id: "rT", delta: "AAAA" });
    await wait(450);
    expect(got.some((e) => e.type === "rw.drop" && e.response_id === "rT" && e.reason === "typing")).toBe(true);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rT")).toBe(false);
    expect(got.some((e) => e.type === "rw.save_note" && e.text === "because teens sleep later")).toBe(true);
    c.close();
  });

  it("never sends a second response.create while one is active; the newest waits for the first to finish", async () => {
    const { c, up, send } = await session();
    up({ type: "response.created", response: { id: "rA" } });
    await wait(30);
    const before = upstream.filter((e) => e.type === "response.create").length;
    send({ type: "rw.text", text: "first typed" });
    send({ type: "rw.text", text: "second typed" });
    await wait(80);
    expect(upstream.filter((e) => e.type === "response.create").length).toBe(before);
    up({ type: "response.done", response: { id: "rA", status: "completed" } });
    await wait(80);
    expect(upstream.filter((e) => e.type === "response.create").length).toBe(before + 1);
    // Both typed messages reached the conversation; one reply answers them.
    expect(upstream.filter((e) => (e.item as { type?: string } | undefined)?.type === "message").length).toBe(2);
    c.close();
  });

  it("an app-triggered line that repeats what she just said is dropped before it's heard", async () => {
    const { c, got, up, send, herLine } = await session();
    const line = "Nice, that's a real reason. What's one example from the reading that shows it?";
    herLine("r1", line);
    await wait(60);
    send({ type: "rw.screen", text: "Question on screen: one example?", choices: [] });
    send({ type: "rw.turn", text: "Question on screen: one example from the reading?" });
    await wait(100);
    const created = upstream.filter((e) => e.type === "response.create").length;
    expect(created).toBeGreaterThan(0);
    up({ type: "response.created", response: { id: "rR" } });
    up({ type: "response.output_audio.delta", response_id: "rR", delta: "AAAA" });
    up({ type: "response.output_audio_transcript.delta", response_id: "rR", delta: "Nice, that's a real reason. What's one example from the reading" });
    await wait(100);
    // rw.turn isn't repeat-checked (latency), so this one plays...
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rR")).toBe(true);
    up({ type: "response.done", response: { id: "rR", status: "completed" } });
    await wait(50);
    send({ type: "rw.idle" });
    // ...but a follow-up nudge (repeat-checked) saying it again is dropped.
    send({ type: "rw.screen", text: "Question on screen: one example?", choices: ["Yes"], followUp: true });
    await wait(150);
    up({ type: "response.created", response: { id: "rF" } });
    up({ type: "response.output_audio.delta", response_id: "rF", delta: "AAAA" });
    up({ type: "response.output_audio_transcript.delta", response_id: "rF", delta: "Nice, that's a real reason. What's one example from the reading that shows it?" });
    await wait(100);
    expect(got.some((e) => e.type === "rw.drop" && e.response_id === "rF" && e.reason === "repeat")).toBe(true);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rF")).toBe(false);
    c.close();
  });

  it("after a reconnect, the line the glitch cut is picked up from where it stopped", async () => {
    const { c, send } = await session();
    send({ type: "rw.resume_hint", remainder: "and two reasons. What's your first reason?" });
    await wait(120);
    const cr = upstream.filter((e) => e.type === "response.create").at(-1) as { response: { instructions: string } } | undefined;
    expect(cr?.response.instructions).toContain("The call glitched");
    expect(cr?.response.instructions).toContain("What's your first reason?");
    c.close();
  });
});
