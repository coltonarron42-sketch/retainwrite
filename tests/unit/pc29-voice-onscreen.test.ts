/**
 * PC-29 QA round 2 (PR #65, 46b4f0f): Stage 1 voice says the on-screen prompt word for
 * word and never asks a question that isn't the on-screen one. The card is the
 * confirmation (no spoken recap), voice turned on mid-chat says the current prompt,
 * and the app's next prompt after a spoken answer is the app's copy, not hers.
 */
import { afterAll, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runRelay } from "@/lib/voice/realtime/relay";
import { completeSentences, questionAllowed, questionsOf } from "@/lib/voice/realtime/turns";
import { readBackSpoken, stage1VoiceScreen } from "@/lib/stage1/voice-turn";
import { buildStage1Instructions } from "@/lib/voice/realtime/persona";

const base = { screen: "coaching", qIndex: 1, question: "Where are you with it?", ask: "Where are you with it?", lastPau: [], turns: 1, angles: ["A", "B"], editing: false, error: null, greeting: "Hi, I'm Pau. What's the assignment we're working on?" };

describe("Stage 1 on-screen prompt, word for word", () => {
  it("says the on-screen question exactly (no paraphrase, no added question)", () => {
    expect(stage1VoiceScreen(base).spoken).toBe("Where are you with it?");
    expect(stage1VoiceScreen({ ...base, qIndex: -1, ask: "Next up is the change part: which leadership style fits it?" }).spoken).toBe(
      "Last one before the stance interview. Next up is the change part: which leadership style fits it?",
    );
    expect(stage1VoiceScreen({ ...base, editing: true }).spoken).toBe("Sure, change anything and send it again. Where are you with it?");
    expect(stage1VoiceScreen({ ...base, teach: "Northouse says leaders adapt." }).spoken).toBe("Northouse says leaders adapt. Where are you with it?");
    expect(stage1VoiceScreen({ ...base, screen: "upload" }).spoken).toBe("Hi, I'm Pau. What's the assignment we're working on?");
    expect(stage1VoiceScreen({ ...base, screen: "gate" }).spoken).toBe("That's everything for Stage 1. Ready for the stance interview?");
    expect(stage1VoiceScreen({ ...base, screen: "parsing" }).spoken).toBe("");
    expect(stage1VoiceScreen({ ...base, screen: "ai_policy" }).spoken).toBe("");
    // The data text for her is unchanged.
    expect(stage1VoiceScreen(base).text).toContain("Question on screen: Where are you with it?");
  });

  it("the read-back card is the confirmation: only its closing line is said, never a recap (QA SHOULD 3)", () => {
    const paras = ["Course: LEAD 210. Topic: leadership styles.", "In plain words, here's what it's asking: compare two styles.", "It's due Friday. Does that look right? Tap Looks good, or tell me what to change."];
    expect(readBackSpoken(paras, 1)).toBe(paras[2]);
    expect(stage1VoiceScreen({ ...base, screen: "card", lastPau: paras, turns: 1 }).spoken).toBe(paras[2]);
    // A later short app reply on the card is its own words, whole.
    expect(readBackSpoken(["Fixed the due date.", "Anything else?"], 3)).toBe("Fixed the due date. Anything else?");
  });

  it("finds sentences as they stream ('?' ends one at once; '3.5' doesn't end one)", () => {
    expect(completeSentences("Ha, love that. So what", 0).map((s) => s.text)).toEqual(["Ha, love that."]);
    expect(completeSentences("It scored 3.5 overall", 0)).toEqual([]);
    expect(completeSentences("Okay. Where are you with it?", 0).map((s) => s.text.trim())).toEqual(["Okay.", "Where are you with it?"]);
    expect(completeSentences("Done.", 0)).toEqual([]);
    expect(completeSentences("Done.", 0, true).map((s) => s.text)).toEqual(["Done."]);
    expect(questionsOf("Last one before the stance interview. Next up is the change part: who fits your pick best?")).toEqual(["Next up is the change part: who fits your pick best?"]);
  });

  it("only the on-screen question may be asked (QA cases a, b, c)", () => {
    expect(questionAllowed("So, quick one — what topics, hobbies, or people do you actually enjoy following right now?", "Where are you with it?")).toBe(false);
    expect(questionAllowed("Last one before we move on: what's your early take on which leadership style works best?", "Next up is the change part: which style handles change best?")).toBe(false);
    expect(questionAllowed("Hey, you're live! What's the screen showing you right now?", "Who fits your pick best?")).toBe(false);
    expect(questionAllowed("Where are you with it?", "Where are you with it?")).toBe(true);
    expect(questionAllowed("Okay, so where are you with it?", "Where are you with it?")).toBe(true);
    expect(questionAllowed("Who fits your pick best?", "Last one. Who fits your pick best?")).toBe(true);
    // Nothing on screen asks anything: no question at all.
    expect(questionAllowed("What's next for you?", "The app is reading their assignment now.")).toBe(false);
  });

  it("her Stage 1 rules: the app says prompts itself; her replies never ask their own question", () => {
    const s1 = buildStage1Instructions("state");
    expect(s1).toContain("The app says each on-screen prompt aloud itself, word for word");
    expect(s1).toContain("Never make up a question of your own");
    expect(s1).toContain("never recap or summarize it out loud");
    expect(s1).not.toContain("ask the on-screen question in your own natural words");
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
/** 100 ms of PCM16 at 24 kHz, base64. */
const chunk100 = Buffer.alloc(4800, 1).toString("base64");
const msOf = (evs: Ev[]) => evs.reduce((n, e) => n + (Buffer.from(String(e.delta ?? ""), "base64").length / 48), 0);
const forcedTexts = (up: Ev[]) =>
  up.filter((e) => (e.item as { type?: string } | undefined)?.type === "force_message").map((e) => (e.item as { content: { text: string }[] }).content[0]!.text);

describe("relay: Stage 1 voice follows the screen (scripted xAI events)", () => {
  let upstream: Ev[] = [];
  let upSock: WebSocket | null = null;
  const xai = new WebSocketServer({ port: 0 });
  xai.on("connection", (ws) => {
    upSock = ws;
    upstream = [];
    ws.on("message", (d, bin) => !bin && upstream.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: "session.created" }));
    ws.send(JSON.stringify({ type: "conversation.created", conversation: { id: "conv_pc29b" } }));
  });
  const front = new WebSocketServer({ port: 0 });
  front.on("connection", (client) => {
    void runRelay({ client, supabase: fakeDb, userId: "u", paperId: "00000000-0000-4000-8000-000000000000", apiKey: "k", resumeToken: null, effort: "none", vad: "server", stage: 1 });
  });
  afterAll(() => {
    xai.close();
    front.close();
  });

  async function session(o: { spoken?: string; applied?: (e: Ev) => Ev } = {}) {
    process.env.RW_REALTIME_TEST_URL = `ws://127.0.0.1:${(xai.address() as { port: number }).port}/?model=x`;
    const got: Ev[] = [];
    const c = new WebSocket(`ws://127.0.0.1:${(front.address() as { port: number }).port}`);
    c.on("message", (d) => {
      const e = JSON.parse(d.toString()) as Ev;
      got.push(e);
      if (e.type === "rw.save_note") c.send(JSON.stringify(o.applied ? o.applied(e) : { type: "rw.applied", call_id: e.call_id, ok: true, result: "in_box" }));
    });
    await new Promise((r) => c.on("open", r));
    await wait(200);
    const up = (e: Ev) => upSock!.send(JSON.stringify(e));
    const send = (e: Ev) => c.send(JSON.stringify(e));
    if (o.spoken) {
      send({ type: "rw.screen", text: "Question on screen", choices: [], spoken: o.spoken });
      await wait(30);
    }
    return { c, got, up, send };
  }

  it("a new on-screen step is said word for word (force_message), not re-worded by the model", async () => {
    const { c, send } = await session({ spoken: "Where are you with it?" });
    const creates = upstream.filter((e) => e.type === "response.create").length;
    send({ type: "rw.turn", text: "Question on screen: Who fits your pick best?", spoken: "Who fits your pick best?" });
    await wait(80);
    expect(forcedTexts(upstream)).toEqual(["Who fits your pick best?"]);
    expect(upstream.filter((e) => e.type === "response.create").length).toBe(creates);
    // The same line again right away isn't said twice.
    send({ type: "rw.turn", text: "Question on screen: Who fits your pick best?", spoken: "Who fits your pick best?" });
    await wait(60);
    expect(forcedTexts(upstream)).toHaveLength(1);
    c.close();
  });

  it("voice turned on mid-chat says the current on-screen prompt (QA case c)", async () => {
    const { c, send } = await session();
    send({ type: "rw.start", welcome: false, welcomeIndex: 0 });
    send({ type: "rw.screen", text: "Question on screen: Who fits your pick best?", choices: [], spoken: "Who fits your pick best?" });
    await wait(120);
    expect(forcedTexts(upstream)).toEqual(["Who fits your pick best?"]);
    expect(upstream.filter((e) => e.type === "response.create")).toHaveLength(0);
    c.close();
  });

  it("her own question that isn't on screen is cut before it's heard; her reaction plays (QA case a)", async () => {
    const { c, got, up } = await session({ spoken: "Where are you with it?" });
    up({ type: "input_audio_buffer.committed", item_id: "s1" });
    up({ type: "conversation.item.input_audio_transcription.completed", item_id: "s1", transcript: "I'm doing a paper on leadership for my business class." });
    await wait(30);
    up({ type: "response.created", response: { id: "rQ" } });
    up({ type: "response.output_item.added", response_id: "rQ", item: { id: "m_rQ", type: "message" } });
    // "Ha, love that. " is 15 characters, about 0.9 s of speech.
    up({ type: "response.output_audio_transcript.delta", response_id: "rQ", delta: "Ha, love that. " });
    for (let i = 0; i < 10; i++) up({ type: "response.output_audio.delta", response_id: "rQ", delta: chunk100 });
    up({ type: "response.output_audio_transcript.delta", response_id: "rQ", delta: "So, quick one — what topics, hobbies, or people do you actually enjoy following right now?" });
    for (let i = 0; i < 40; i++) up({ type: "response.output_audio.delta", response_id: "rQ", delta: chunk100 });
    up({ type: "response.output_audio_transcript.done", response_id: "rQ", transcript: "Ha, love that. So, quick one — what topics, hobbies, or people do you actually enjoy following right now?" });
    up({ type: "response.done", response: { id: "rQ", status: "completed" } });
    await wait(150);
    const audio = got.filter((e) => e.type === "response.output_audio.delta" && e.response_id === "rQ");
    const heardMs = msOf(audio);
    expect(heardMs).toBeGreaterThan(700);
    expect(heardMs).toBeLessThan(1100);
    const shown = got.filter((e) => e.type === "response.output_audio_transcript.delta" && e.response_id === "rQ").map((e) => e.delta).join("");
    expect(shown).toContain("Ha, love that.");
    expect(shown).not.toContain("quick one");
    const done = got.find((e) => e.type === "response.output_audio_transcript.done" && e.response_id === "rQ");
    expect(done?.transcript).toBe("Ha, love that.");
    // xAI's copy keeps only what was heard.
    const tr = upstream.find((e) => e.type === "conversation.item.truncate") as { item_id: string; audio_end_ms: number } | undefined;
    expect(tr?.item_id).toBe("m_rQ");
    expect(Math.abs(tr!.audio_end_ms - heardMs)).toBeLessThan(5);
    c.close();
  });

  it("the on-screen question itself (or no question) plays in full", async () => {
    const { c, got, up } = await session({ spoken: "Where are you with it?" });
    up({ type: "response.created", response: { id: "rOK" } });
    up({ type: "response.output_audio_transcript.delta", response_id: "rOK", delta: "Got it. Where are you with it?" });
    for (let i = 0; i < 20; i++) up({ type: "response.output_audio.delta", response_id: "rOK", delta: chunk100 });
    up({ type: "response.done", response: { id: "rOK", status: "completed" } });
    await wait(120);
    expect(msOf(got.filter((e) => e.type === "response.output_audio.delta" && e.response_id === "rOK"))).toBe(2000);
    expect(upstream.some((e) => e.type === "conversation.item.truncate")).toBe(false);
    c.close();
  });

  it("after a spoken answer moves the app on, the next prompt is the app's copy, word for word (QA case b)", async () => {
    const { c, up } = await session({
      spoken: "Where are you with it?",
      applied: (e) => ({ type: "rw.applied", call_id: e.call_id, ok: true, result: "saved", screen: "Question on screen: ...", spoken: "Last one before the stance interview. Next up is the change part: which style handles change best?" }),
    });
    up({ type: "response.created", response: { id: "rS" } });
    up({ type: "response.output_audio_transcript.delta", response_id: "rS", delta: "Nice, that's honest. " });
    up({ type: "response.function_call_arguments.done", response_id: "rS", call_id: "c_sub", name: "submit_answer", arguments: "{}" });
    up({ type: "response.done", response: { id: "rS", status: "completed" } });
    await wait(400);
    expect(forcedTexts(upstream)).toEqual(["Last one before the stance interview. Next up is the change part: which style handles change best?"]);
    // No model-worded "ask the next question" response.
    expect(upstream.filter((e) => e.type === "response.create")).toHaveLength(0);
    // Its tool result tells her the app says the prompt itself.
    const out = upstream.find((e) => (e.item as { type?: string } | undefined)?.type === "function_call_output") as { item: { output: string } } | undefined;
    expect(out?.item.output).toContain("says its next prompt aloud itself");
    c.close();
  });

  it("an app line (force_message) is never held or dropped as a 'reply' to the student's turn", async () => {
    const { c, got, up, send } = await session({ spoken: "Where are you with it?" });
    up({ type: "input_audio_buffer.committed", item_id: "n9" });
    send({ type: "rw.turn", text: "Question on screen: Who fits your pick best?", spoken: "Who fits your pick best?" });
    await wait(60);
    up({ type: "response.created", response: { id: "rF" } });
    up({ type: "response.output_audio.delta", response_id: "rF", delta: chunk100 });
    await wait(60);
    expect(got.some((e) => e.type === "response.output_audio.delta" && e.response_id === "rF")).toBe(true);
    expect(got.some((e) => e.type === "rw.drop" && e.response_id === "rF")).toBe(false);
    c.close();
  });
});
