/**
 * PC-29d (QA on PR #68, qa6 paper d2803571): in Stage 1 voice a side question ("What does the
 * assignment want from me?") got a text answer and silence (73 s to ~180 s). The relay session
 * shows 5 verbatim lines, 0 audio in, 0 text inputs, 0 question cuts: the side answer was never
 * handed to voice at all (Stage 1 voice only ever said the pacer's on-screen prompt). Also: a nudge
 * re-read the whole early-take prompt, and the reply wait showed assignment-reading wording.
 */
import { afterAll, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runRelay } from "@/lib/voice/realtime/relay";
import { asideSpoken, AsideVoice, Stage1VoicePacer, stage1VoiceScreen, withoutNote } from "@/lib/stage1/voice-turn";
import { friendlyStatus, isAssignmentRead, readingFooter } from "@/lib/stage1/reading-status";

describe("side answers are spoken", () => {
  it("says the answer's words, then a short way back (never the prompt again)", () => {
    const paras = [
      "Servant leadership means the leader's first job is helping the team grow. From general background, not your readings: Robert Greenleaf coined it in 1970.",
      "Back to my question whenever you're ready.",
    ];
    const s = asideSpoken(paras);
    expect(s).toBe(
      "Servant leadership means the leader's first job is helping the team grow. From general background, not your readings: Robert Greenleaf coined it in 1970. Okay, back to your question.",
    );
    expect(s).not.toContain("whenever you're ready");
  });
  it("no links or markdown out loud; long answers end on a sentence", () => {
    expect(asideSpoken(["**Key idea:** see https://example.com/x for more.", "- Point one."])).toBe("Key idea: see for more. Point one.");
    const long = Array.from({ length: 40 }, (_, i) => `Sentence ${i} is here.`).join(" ");
    const s = asideSpoken([long], 200);
    expect(s.length).toBeLessThanOrEqual(200);
    expect(s.endsWith(".")).toBe(true);
    expect(asideSpoken(["Back to my question whenever you're ready."])).toBe("");
  });
  it("only new asides while voice is on are spoken (not restored ones, not ones there when voice came on)", () => {
    const a = new AsideVoice();
    expect(a.step(5, false)).toBe(false); // restored
    expect(a.step(5, true)).toBe(false); // voice came on
    expect(a.step(9, true)).toBe(true); // a new side answer
    expect(a.step(9, true)).toBe(false); // re-render
    expect(a.step(12, false)).toBe(false); // voice off
    expect(a.step(12, true)).toBe(false);
    const b = new AsideVoice();
    expect(b.step(null, true)).toBe(false);
    expect(b.step(3, true)).toBe(true);
  });
});

describe("a nudge is said alone", () => {
  const base = { screen: "coaching", qIndex: -1, question: "What's your early take?", ask: "What's your early take?", lastPau: [], turns: 1, angles: [], editing: false, error: null, greeting: "Hi" };
  it("the screen knows the prompt without its note", () => {
    const v = stage1VoiceScreen({ ...base, error: "Almost. Now the why: what makes it the right call?" });
    expect(v.spoken).toBe("Almost. Now the why: what makes it the right call? Last one before the stance interview. What's your early take?");
    expect(v.base).toBe("Last one before the stance interview. What's your early take?");
    expect(v.note).toBe("Almost. Now the why: what makes it the right call?");
    expect(withoutNote(v.spoken, v.note)).toBe(v.base);
    expect(withoutNote("Ready? Oops.", "Oops.")).toBe("Ready?");
  });
  it("after the prompt was said, a nudge says only the nudge; a cleared nudge says nothing; a new nudge says itself", () => {
    const p = new Stage1VoicePacer({ settleMs: 0, maxMs: 0 });
    const prompt = "Last one before the stance interview. What's your early take?";
    const k = "q:-1:";
    p.step({ key: "q:0:", line: "Where are you with it?", now: 0, busy: false });
    expect(p.step({ key: k, line: prompt, now: 1, busy: false }).say).toBe(prompt);
    const n1 = "Almost. Now the why: what makes it the right call?";
    const r1 = p.step({ key: k, line: `${n1} ${prompt}`, now: 2, busy: false, note: n1, base: prompt });
    expect(r1.say).toBe(n1);
    expect(r1.spoken).toBe(`${n1} ${prompt}`);
    expect(p.step({ key: k, line: `${n1} ${prompt}`, now: 3, busy: false, note: n1, base: prompt }).say).toBeNull();
    expect(p.step({ key: k, line: prompt, now: 4, busy: false, note: "", base: prompt }).say).toBeNull();
    const n2 = "Closer. Add the example: who shows it?";
    expect(p.step({ key: k, line: `${n2} ${prompt}`, now: 5, busy: false, note: n2, base: prompt }).say).toBe(n2);
    // A new step still says its whole prompt.
    expect(p.step({ key: "gate", line: "Ready for the stance interview?", now: 6, busy: false }).say).toBe("Ready for the stance interview?");
  });
});

describe("reply wait status", () => {
  it("short, friendly, and no assignment-reading footer after a chat send", () => {
    expect(friendlyStatus("Digging it up…")).toBe("Looking into that…");
    expect(friendlyStatus("Digging it up… pulling together the key points.")).toBe("Pulling together the key points…");
    expect(friendlyStatus("Digging it up… (I'm checking what I know about your readings)")).toBe("Checking what I know about your readings…");
    expect(friendlyStatus("Thinking…")).toBe("Thinking…");
    expect(readingFooter("Digging it up…", 5)).toBeNull();
    expect(readingFooter("Thinking…", 5)).toBeNull();
    expect(isAssignmentRead("Reading the assignment…")).toBe(true);
    expect(readingFooter("Reading the assignment…", 5)).toContain("Still reading… 5s.");
    expect(friendlyStatus("Reading the assignment…")).toBe("Reading the assignment…");
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
const forcedTexts = (up: Ev[]) =>
  up.filter((e) => (e.item as { type?: string } | undefined)?.type === "force_message").map((e) => (e.item as { content: { text: string }[] }).content[0]!.text);

describe("relay: a side answer is spoken, the prompt isn't re-read", () => {
  let upstream: Ev[] = [];
  let upSock: WebSocket | null = null;
  const xai = new WebSocketServer({ port: 0 });
  xai.on("connection", (ws) => {
    upSock = ws;
    upstream = [];
    ws.on("message", (d, bin) => !bin && upstream.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: "session.created" }));
    ws.send(JSON.stringify({ type: "conversation.created", conversation: { id: "conv_pc29d" } }));
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
    const send = (e: Ev) => c.send(JSON.stringify(e));
    send({ type: "rw.screen", text: "Question on screen", choices: [], spoken });
    await wait(30);
    return { c, got, up, send };
  }
  const PROMPT = "What's your early take?";
  const ASIDE = "Servant leadership means the leader serves the team first. Okay, back to your question.";

  it("says the side answer word for word; the on-screen prompt stays the gate's prompt and isn't said again", async () => {
    const { c, send, up, got } = await session(PROMPT);
    const before = forcedTexts(upstream).length;
    send({ type: "rw.turn", text: "Question on screen", spoken: PROMPT, say: ASIDE });
    await wait(80);
    expect(forcedTexts(upstream).slice(before)).toEqual([ASIDE]);
    // The forced line's own response, then her later reply: it may still ask the on-screen
    // question (the prompt wasn't replaced by the aside), and an off-screen one is still cut.
    up({ type: "response.created", response: { id: "rF" } });
    up({ type: "response.done", response: { id: "rF", status: "completed" } });
    await wait(30);
    up({ type: "response.created", response: { id: "rR" } });
    up({ type: "response.output_audio_transcript.delta", response_id: "rR", delta: `Nice. ${PROMPT}` });
    up({ type: "response.output_audio_transcript.done", response_id: "rR", transcript: `Nice. ${PROMPT}` });
    up({ type: "response.done", response: { id: "rR", status: "completed" } });
    await wait(80);
    const done = got.find((e) => e.type === "response.output_audio_transcript.done" && e.response_id === "rR");
    expect(done?.transcript).toBe(`Nice. ${PROMPT}`);
    c.close();
  });

  it("while she's mid-reply the side answer waits for her, then plays", async () => {
    const { c, send, up } = await session(PROMPT);
    up({ type: "response.created", response: { id: "rBusy" } });
    await wait(30);
    const before = forcedTexts(upstream).length;
    send({ type: "rw.turn", text: "Question on screen", spoken: PROMPT, say: ASIDE });
    await wait(60);
    expect(forcedTexts(upstream).length).toBe(before);
    up({ type: "response.done", response: { id: "rBusy", status: "completed" } });
    await wait(150);
    expect(forcedTexts(upstream).slice(before)).toEqual([ASIDE]);
    c.close();
  });
});
