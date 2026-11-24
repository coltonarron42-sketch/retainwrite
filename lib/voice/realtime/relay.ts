import { createHmac, timingSafeEqual } from "node:crypto";
import WebSocket, { type RawData } from "ws";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";
import { rulesStanceIntent } from "@/lib/stages/stance-intent";
import { SWAP_ASK } from "@/lib/stages/stance-turn";
import { gateSpoken } from "@/lib/stages/soft-gate";
import { buildInstructions, buildStage1Instructions, buildStage3Instructions } from "./persona";
import { loadFlowState, loadStage1State, loadStage3State, stage1Block, stage3Block, stateBlock, type FlowState, type Stage1State, type Stage3State } from "./flow-state";
import { essayGuard, GUARD_REDIRECTS, isEcho, wordsFromStudent } from "./guard";
import {
  MAX_TEXT_CHARS,
  REALTIME_RATE,
  REALTIME_VOICE,
  ROTATE_FORCE_AFTER_MS,
  ROTATE_IDLE_AFTER_MS,
  XAI_REALTIME_URL,
} from "./config";
import { checkLinks, type SourceLink } from "./links";

type Json = Record<string, unknown>;

export type RelayContext = {
  client: WebSocket;
  supabase: SupabaseClient;
  userId: string;
  paperId: string;
  apiKey: string;
  resumeToken: string | null;
  effort: "high" | "none";
  /** "client": the browser decides end of turn (faster); "server": xAI server VAD. */
  vad: "client" | "server";
  /** Test-only server VAD tuning (undocumented by xAI; omitted when unset). */
  vadTuning?: { silence_duration_ms?: number; threshold?: number };
  /** Soft-gated stage: speak the scripted gate line once; no listening, tools or notes. */
  gate?: { stage: number; paperStage: number };
  /** The live stage this call coaches: 1 (Intake) or 2 (Stance, the default). */
  stage?: 1 | 2 | 3;
};

const TOOLS = [
  { type: "web_search" },
  {
    type: "function",
    name: "get_flow_state",
    description: "Where the student is right now: stage, section, step, their saved notes, gates still open, and the assignment. Cheap; call it whenever you're unsure.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "show_sources",
    description: "Show 2-4 real links you found with web_search as clickable cards in the chat. The app checks every link first and drops dead or made-up ones.",
    parameters: {
      type: "object",
      properties: {
        links: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, url: { type: "string" }, why: { type: "string", description: "Under 12 words, your own words." } },
            required: ["title", "url"],
          },
        },
      },
      required: ["links"],
    },
  },
];

/** Stage 1 (Intake): the app owns every step; her one write is "move on" (submit_answer). */
const STAGE1_TOOLS = [
  {
    type: "function",
    name: "get_flow_state",
    description: "Where the student is in Stage 1 right now: what the app shows, what's answered, what's left. Cheap; call it whenever you're unsure.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "submit_answer",
    description:
      "The student has finished answering the on-screen question (or asked to move on). The app saves exactly what they said, word for word, runs its checks, and shows the next step. Takes no text: you never supply their answer.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

/** Stage 3 (Outline): same shape; "move on" sends the outline box through the app's own checks. */
const STAGE3_TOOLS = [
  {
    type: "function",
    name: "get_flow_state",
    description: "Where the student is in Stage 3 right now: the open section, their Stance notes, what's outlined. Cheap; call it whenever you're unsure.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "submit_answer",
    description:
      "The student has finished saying their outline for the open section (or asked to move on). The app checks it and saves exactly what they said, word for word, then opens the next section. Takes no text: you never supply their outline.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

const secret = () => process.env.PAU_REALTIME_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";

export function signResume(userId: string, paperId: string, conversationId: string): string {
  const mac = createHmac("sha256", secret()).update(`${userId}|${paperId}|${conversationId}`).digest("base64url");
  return `${Buffer.from(conversationId).toString("base64url")}.${mac}`;
}

export function readResume(token: string | null, userId: string, paperId: string): string | null {
  if (!token) return null;
  const [id64, mac] = token.split(".");
  if (!id64 || !mac) return null;
  const id = Buffer.from(id64, "base64url").toString();
  if (!/^[\w-]{4,200}$/.test(id)) return null;
  const want = createHmac("sha256", secret()).update(`${userId}|${paperId}|${id}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};
const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!;
};

/**
 * One student socket <-> one xAI realtime socket. The relay owns the session:
 * it sends the only session.update, forwards only audio, plain text and
 * cancel from the client, runs every tool, and cancels essay-writing replies.
 */
export async function runRelay(ctx: RelayContext): Promise<void> {
  const { client } = ctx;
  // Hold browser messages that arrive while the flow state loads (before the real
  // handler is attached below); otherwise rw.start was dropped and she never spoke.
  const preMsgs: [RawData, boolean][] = [];
  const holdMsg = (data: RawData, isBinary: boolean) => void (preMsgs.length < 80 && preMsgs.push([data, isBinary]));
  client.on("message", holdMsg);
  const started = Date.now();
  const sid = Math.random().toString(16).slice(2, 10);
  const resumeId = readResume(ctx.resumeToken, ctx.userId, ctx.paperId);
  const m = {
    sid,
    paper: ctx.paperId.slice(0, 8),
    resumed: Boolean(resumeId),
    effort: ctx.effort,
    vad: ctx.vad,
    audioInBytes: 0,
    audioOutBytes: 0,
    textInputs: 0,
    responses: 0,
    tools: {} as Record<string, number>,
    relayLatency: [] as number[],
    clientLatency: [] as number[],
    bargeIn: [] as number[],
    guardTrips: 0,
    echoDropped: 0,
    notesApplied: 0,
    dropped: 0,
    usage: [] as unknown[],
    errors: [] as string[],
  };
  let flow: FlowState | null = null;
  let flow1: Stage1State | null = null;
  const stage1 = ctx.stage === 1 && !ctx.gate;
  const stage3 = ctx.stage === 3 && !ctx.gate;
  let flow3: Stage3State | null = null;
  // Stages where the app owns every step and her only write is submit_answer.
  const appOwned = stage1 || stage3;
  // A spoken yes only counts where yes is the choice: on a Stage 3 section, they say the choice itself.
  const tapHint = (c: string) => (stage3 && !/^Continue to sources$/i.test(c) ? `Tap ${c}, or just say "${c.toLowerCase()}".` : `Tap ${c} when you're happy, or just say yes.`);
  let conversationId: string | null = resumeId;
  let speechStoppedAt = 0;
  const firstDeltaSeen = new Set<string>();
  let responding = false;
  let clientPlaying = false;
  const replyText = new Map<string, string>();
  const guarded = new Set<string>();
  const said: { id: string; text: string }[] = [];
  const studentSaid = { slice: (n: number) => said.slice(n).map((x) => x.text), push: (text: string) => said.push({ id: `t${said.length}`, text }) };
  const pendingCalls = new Map<string, Promise<{ call_id: string; output: string }>>();
  const pendingNames = new Set<string>();
  const herDone: string[] = [];
  let currentRid: string | null = null;
  let lastCommitted: string | null = null;
  const responseAfter = new Map<string, string>();
  const playingAtCommit = new Set<string>();
  const herDoneRid: string[] = [];
  // Her recent lines, minus her replies TO this item (she may repeat a phrase they just said, e.g. "keep my notes").
  const herRecent = (forItem?: string) => [
    ...herDone.slice(-3).filter((_, i, a) => !forItem || responseAfter.get(herDoneRid.slice(-a.length)[i] ?? "") !== forItem),
    currentRid && (!forItem || responseAfter.get(currentRid) !== forItem) ? (replyText.get(currentRid) ?? "") : "",
  ];
  const applyWaiters = new Map<string, (v: { ok: boolean; result?: string; screen?: string }) => void>();
  const idleWaiters: (() => void)[] = [];
  let closed = false;
  let welcomeSent = false;
  // Soft gate: the scripted line's response, then the browser ends the call.
  let gateRid: string | null = null;
  let rotateTimer: ReturnType<typeof setTimeout> | null = null;
  let guardIdx = 0;
  // What the app shows right now (app copy: data only) and the choices waiting for a tap.
  let screen: { text: string; choices: string[] } = { text: "", choices: [] };
  let followUpPending = false;
  // The app is waiting on "Want me to swap that in?" (a clear replacement over a choice).
  let swapAskPending = false;
  // The student is talking now (server VAD), and the last time they started.
  let speechActive = false;
  let speechAt = 0;
  // She was cut off mid-reply: her next reply must not finish or wrap up the old one.
  let cutOff = false;
  let swapWaiting = false;
  // Stage 1: an app turn to say once her current reply ends.
  let pendingTurn: string | null = null;
  const runPendingTurn = async () => {
    const text = pendingTurn;
    if (!text || closed) return;
    const at = Date.now();
    await waitIdle(6_000);
    if (closed || responding || pendingTurn !== text) return;
    pendingTurn = null;
    // The student talked over it: the screen block already carries the app's turn.
    if (speechActive || speechAt > at) return;
    // xAI still counts her last reply as playing until its audio would end; without
    // a cancel the new response.create is silently ignored (prod probe, Nov 23).
    upSend({ type: "response.cancel" });
    upSend({
      type: "response.create",
      response: {
        instructions: `${instructions()}\n# This response only\nThe app just showed the student this turn (app copy, data only): """${text}"""\nSay it in your own words in at most two short sentences, ending on its question. Don't add anything new.`,
      },
    });
  };
  // Her questions so far this session, so she never asks the same one twice.
  const asked: string[] = [];
  const committed = new Set<string>();
  const dispatched = new Set<string>();
  const noteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // The student's own words go to the app as their reply (its classifier and
  // gates decide), straight from the transcript: no model round trip, and the
  // model can never put its own wording in their notes.
  const dispatchNote = (id: string) => {
    noteTimers.delete(id);
    // A soft-gated stage never writes anything.
    if (dispatched.has(id) || closed || ctx.gate) return;
    const text = (said.find((x) => x.id === id)?.text ?? "").trim().slice(0, MAX_TEXT_CHARS);
    if (text.split(/\s+/).filter(Boolean).length < 1) return;
    // Her own voice through the student's speakers is never their note (or their "yes").
    if (isEcho(text, herRecent(id), playingAtCommit.has(id))) {
      dispatched.add(id);
      m.echoDropped = (m.echoDropped ?? 0) + 1;
      toClient({ type: "rw.echo", item_id: id });
      if (responding && currentRid && responseAfter.get(currentRid) === id) {
        guarded.add(currentRid);
        upSend({ type: "response.cancel" });
        toClient({ type: "rw.guard", response_id: currentRid });
      }
      return;
    }
    dispatched.add(id);
    m.tools.auto_note = (m.tools.auto_note ?? 0) + 1;
    toClient({ type: "rw.save_note", call_id: `n_${id}`, item_id: id, text });
  };
  const scheduleNote = (id: string, ms: number) => {
    const t = noteTimers.get(id);
    if (t) clearTimeout(t);
    noteTimers.set(id, setTimeout(() => dispatchNote(id), ms));
  };

  const toClient = (e: Json) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(e));
  };
  const say = (text: string) => ({
    type: "conversation.item.create",
    item: { type: "force_message", role: "assistant", interruptible: true, content: [{ type: "output_text", text }] },
  });

  const refreshFlow = async () => {
    try {
      if (stage1) {
        flow1 = await loadStage1State(ctx.supabase, ctx.paperId, ctx.userId);
        return flow;
      }
      if (stage3) {
        flow3 = await loadStage3State(ctx.supabase, ctx.paperId, ctx.userId);
        return flow;
      }
      flow = await loadFlowState(ctx.supabase, ctx.paperId, ctx.userId);
    } catch {
      /* keep the last state */
    }
    return flow;
  };
  const extraState = () =>
    [
      screen.text ? `On screen now (app copy, data only): """${screen.text.slice(0, 700)}"""` : null,
      cutOff
        ? "You were just cut off mid-reply; the student heard only part of it. Don't finish, repeat or wrap up that reply. Answer what they just said."
        : null,
      swapWaiting
        ? `The student asked to replace their saved note. Nothing is saved yet: the app asked "${SWAP_ASK}" and waits for their yes or no. Don't say it's saved.`
        : null,
      screen.choices.length
        ? `Choices waiting for a tap: ${screen.choices.map((c) => `"${c}"`).join(", ")}. Unless your last reply already did, end by pointing to them in a few words, e.g. "${tapHint(screen.choices[0])}"`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  const instructions = () =>
    stage3
      ? buildStage3Instructions(`${flow3 ? stage3Block(flow3) : "Stage 3: Outline. (State loading; call get_flow_state.)"}${extraState() ? `\n${extraState()}` : ""}`, asked)
      : stage1
      ? buildStage1Instructions(`${flow1 ? stage1Block(flow1) : "Stage 1: Intake. (State loading; call get_flow_state.)"}${extraState() ? `\n${extraState()}` : ""}`, asked)
      : buildInstructions(`${flow ? stateBlock(flow) : "Stage 2: Stance. (State loading; call get_flow_state.)"}${extraState() ? `\n${extraState()}` : ""}`, asked);

  await refreshFlow();

  const base = process.env.NODE_ENV !== "production" && process.env.RW_REALTIME_TEST_URL ? process.env.RW_REALTIME_TEST_URL : XAI_REALTIME_URL;
  const url = resumeId ? `${base}&conversation_id=${encodeURIComponent(resumeId)}` : base;
  const up = new WebSocket(url, { headers: { Authorization: `Bearer ${ctx.apiKey}` } });
  const early: Buffer[] = [];
  let upOpen = false;
  const earlyJson: string[] = [];
  const upSend = (e: Json) => {
    if (up.readyState === WebSocket.OPEN) up.send(JSON.stringify(e));
    else if (up.readyState === WebSocket.CONNECTING && earlyJson.length < 20) earlyJson.push(JSON.stringify(e));
  };

  const sessionUpdate = () =>
    upSend({
      type: "session.update",
      session: {
        voice: REALTIME_VOICE,
        instructions: instructions(),
        reasoning: { effort: ctx.effort },
        turn_detection: ctx.gate || ctx.vad === "client" ? null : { type: "server_vad", ...(ctx.vadTuning ?? {}) },
        tools: ctx.gate ? [] : stage1 ? STAGE1_TOOLS : stage3 ? STAGE3_TOOLS : TOOLS,
        audio: {
          input: {
            format: { type: "audio/pcm", rate: REALTIME_RATE },
            transport: "binary",
            transcription: { model: "grok-transcribe", keyterms: ["Pau Pau", "RetainWrite"] },
          },
          output: { format: { type: "audio/pcm", rate: REALTIME_RATE }, speed: 1.05 },
        },
        resumption: { enabled: true },
        replace: { "Pau Pau": "Pow pow" },
      },
    });

  const waitIdle = (maxMs: number) =>
    new Promise<void>((resolve) => {
      if (!clientPlaying) return resolve();
      const t = setTimeout(resolve, maxMs);
      idleWaiters.push(() => {
        clearTimeout(t);
        resolve();
      });
    });

  // A voice note moved the app to a turn with choices: one short pointer to them
  // after her current reply (never a second full reply).
  const runFollowUp = async () => {
    if (responding || closed) return;
    followUpPending = false;
    const asked0 = Date.now();
    const choices0 = screen.choices.join("|");
    await waitIdle(6_000);
    // A late prompt is worse than none: skip it once the student talks, the
    // choices change, or her last reply already pointed to them.
    if (responding || closed || !screen.choices.length || speechActive || speechAt > asked0) return;
    if (screen.choices.join("|") !== choices0 || Date.now() - asked0 > 8_000) return;
    if (/\b(tap|say yes|just say)\b/i.test(herDone[herDone.length - 1] ?? "")) return;
    upSend({
      type: "response.create",
      response: {
        instructions: `${instructions()}\n# This response only\nThe app just showed new choices: ${screen.choices.map((c) => `"${c}"`).join(", ")}. In one short sentence (under 15 words), tell them what to tap, e.g. "${tapHint(screen.choices[0])}" Don't repeat what you just said and don't ask another question.`,
      },
    });
  };

  // She says the app's swap question in its exact words, once, after her reply ends.
  const runSwapAsk = async () => {
    if (responding || closed) return;
    swapAskPending = false;
    const asked0 = Date.now();
    await waitIdle(6_000);
    if (responding || closed || !swapWaiting || speechActive || speechAt > asked0) return;
    if (/\bswap\b/i.test(herDone[herDone.length - 1] ?? "")) return;
    upSend(say(SWAP_ASK));
  };

  const finish = (code: number, reason: string) => {
    if (closed) return;
    closed = true;
    if (rotateTimer) clearTimeout(rotateTimer);
    const minutes = (Date.now() - started) / 60000;
    console.log(
      JSON.stringify({
        evt: "pau_realtime_session",
        ...m,
        reason,
        connectedMin: +minutes.toFixed(2),
        audioInSec: +(m.audioInBytes / (REALTIME_RATE * 2)).toFixed(1),
        audioOutSec: +(m.audioOutBytes / (REALTIME_RATE * 2)).toFixed(1),
        estCostUsd: +(minutes * 0.08 + m.textInputs * 0.004 + (m.tools.web_search ?? 0) * 0.005).toFixed(4),
        relayP50: median(m.relayLatency),
        relayP90: pct(m.relayLatency, 0.9),
        clientP50: median(m.clientLatency),
        clientP90: pct(m.clientLatency, 0.9),
        bargeP50: median(m.bargeIn),
        usage: m.usage.slice(-5),
      }),
    );
    try {
      up.close();
    } catch {}
    try {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    } catch {}
  };

  const rotate = () => {
    if (closed) return;
    if (conversationId) toClient({ type: "rw.rotate", resume: signResume(ctx.userId, ctx.paperId, conversationId) });
    finish(4000, "rotate");
  };
  const scheduleRotate = () => {
    const check = () => {
      if (closed) return;
      const age = Date.now() - started;
      if (age >= ROTATE_FORCE_AFTER_MS || (age >= ROTATE_IDLE_AFTER_MS && !responding && !clientPlaying)) return rotate();
      rotateTimer = setTimeout(check, 2_000);
    };
    rotateTimer = setTimeout(check, ROTATE_IDLE_AFTER_MS);
  };
  scheduleRotate();

  /* ------------------------------ tools ------------------------------ */
  async function runTool(name: string, callId: string, rawArgs: string): Promise<{ call_id: string; output: string }> {
    m.tools[name] = (m.tools[name] ?? 0) + 1;
    let args: Json = {};
    try {
      args = JSON.parse(rawArgs || "{}") as Json;
    } catch {}
    const out = (o: unknown) => ({ call_id: callId, output: JSON.stringify(o) });
    if (name === "get_flow_state" && stage3) {
      await refreshFlow();
      return out(flow3 ? { state: `${stage3Block(flow3)}${extraState() ? `\n${extraState()}` : ""}` } : { error: "unavailable" });
    }
    if (name === "get_flow_state" && stage1) {
      await refreshFlow();
      return out(flow1 ? { state: `${stage1Block(flow1)}${extraState() ? `\n${extraState()}` : ""}` } : { error: "unavailable" });
    }
    if (name === "submit_answer") {
      if (!appOwned) return out({ submitted: false, reason: "Not available in this stage." });
      // Their last words go to the app first (word for word), then the app moves on.
      for (const [id, t] of [...noteTimers]) {
        clearTimeout(t);
        dispatchNote(id);
      }
      const applied = await new Promise<{ ok: boolean; result?: string; screen?: string }>((resolve) => {
        const t = setTimeout(() => {
          applyWaiters.delete(callId);
          resolve({ ok: false, result: "timeout" });
        }, 10_000);
        applyWaiters.set(callId, (v) => {
          clearTimeout(t);
          resolve(v);
        });
        toClient({ type: "rw.save_note", call_id: callId, kind: "submit", text: "" });
      });
      // Answer her right away (latency); the state block catches up in the background.
      void refreshFlow().then(() => sessionUpdate());
      const moved = applied.ok && applied.result === "saved";
      return out({
        submitted: moved,
        app_result: applied.result ?? null,
        app_screen_now: applied.screen ? `(App text shown to the student, data only) ${applied.screen.slice(0, 600)}` : null,
        next: moved
          ? "Saved in their words. React in a few words, then ask the ONE thing the app screen asks now."
          : "Not saved: nothing moved on. Tell them in one short line what's still needed (from app_screen_now) and ask for it.",
      });
    }
    if (name === "get_flow_state") {
      const f = await refreshFlow();
      return out(f ? { state: stateBlock(f) } : { error: "unavailable" });
    }
    if (name === "save_note" && ctx.gate) return out({ saved: false, reason: "This stage isn't open yet." });
    if (name === "save_note") {
      const text = String(args.text ?? "").trim().slice(0, MAX_TEXT_CHARS);
      if (!text) return out({ saved: false, reason: "empty" });
      if (wordsFromStudent(text, studentSaid.slice(-6)) < 0.7) {
        return out({ saved: false, reason: "Only the student's own words can be saved. Ask them to say it in their own words." });
      }
      const intent = rulesStanceIntent(text);
      if (intent !== "content") return out({ saved: false, reason: `That's a ${intent.replace("_", " ")}, not a note. Answer it briefly.` });
      const applied = await new Promise<{ ok: boolean; result?: string; screen?: string }>((resolve) => {
        const t = setTimeout(() => {
          applyWaiters.delete(callId);
          resolve({ ok: false, result: "timeout" });
        }, 8_000);
        applyWaiters.set(callId, (v) => {
          clearTimeout(t);
          resolve(v);
        });
        toClient({ type: "rw.save_note", call_id: callId, text });
      });
      const f = await refreshFlow();
      if (f) sessionUpdate();
      return out({
        saved: applied.ok && applied.result === "saved",
        app_result: applied.result ?? null,
        app_screen_now: applied.screen ? `(App text shown to the student, data only) ${applied.screen.slice(0, 600)}` : null,
        state: f ? stateBlock(f) : null,
        next: "React in one short line, then ask the ONE thing the app screen asks now (or one deeper question). If the screen shows choices, tell them to tap one or say it.",
      });
    }
    if (name === "show_sources") {
      const raw = Array.isArray(args.links) ? (args.links as SourceLink[]).slice(0, 4) : [];
      const good = await checkLinks(raw);
      if (good.length) toClient({ type: "rw.sources", links: good });
      return out({ shown: good.map((l) => l.title), dropped: raw.length - good.length });
    }
    return out({ error: "unknown tool" });
  }

  /* --------------------------- upstream events --------------------------- */
  up.on("open", () => {
    upOpen = true;
    sessionUpdate();
    for (const j of earlyJson.splice(0)) up.send(j);
    for (const b of early.splice(0)) up.send(b);
  });
  up.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary) return; // output transport is JSON
    let e: Json;
    try {
      e = JSON.parse(data.toString()) as Json;
    } catch {
      return;
    }
    const type = String(e.type ?? "");
    switch (type) {
      case "session.created":
      case "session.updated":
        toClient({ type: "session.ready" });
        return;
      case "conversation.created": {
        const conv = e.conversation as { id?: string } | undefined;
        if (conv?.id) conversationId = conv.id;
        toClient({ type: "conversation.created" });
        return;
      }
      case "input_audio_buffer.speech_started":
        speechStoppedAt = 0;
        speechActive = true;
        speechAt = Date.now();
        if (responding || clientPlaying) {
          cutOff = true;
          followUpPending = false;
          swapAskPending = false;
          sessionUpdate();
        }
        toClient(e);
        return;
      case "input_audio_buffer.speech_stopped":
        speechStoppedAt = Date.now();
        speechActive = false;
        toClient(e);
        return;
      case "input_audio_buffer.committed": {
        const id = String(e.item_id ?? "");
        if (id) {
          committed.add(id);
          lastCommitted = id;
          if (clientPlaying || responding) playingAtCommit.add(id);
          scheduleNote(id, 900);
        }
        toClient(e);
        return;
      }
      case "conversation.item.input_audio_transcription.updated":
      case "conversation.item.input_audio_transcription.completed": {
        const id = String(e.item_id ?? "");
        const t = String(e.transcript ?? "");
        if (id) {
          const row = said.find((x) => x.id === id);
          if (row) row.text = t;
          else said.push({ id, text: t });
          if (said.length > 20) said.splice(0, said.length - 20);
          if (committed.has(id) && type.endsWith("completed")) scheduleNote(id, 250);
        }
        toClient(e);
        return;
      }
      case "response.created": {
        responding = true;
        m.responses++;
        const r = e.response as { id?: string } | undefined;
        if (r?.id) {
          replyText.set(r.id, "");
          currentRid = r.id;
          if (lastCommitted) responseAfter.set(r.id, lastCommitted);
          lastCommitted = null;
        }
        toClient(e);
        return;
      }
      case "response.output_audio.delta": {
        const rid = String(e.response_id ?? "");
        if (guarded.has(rid)) return;
        const d = String(e.delta ?? "");
        m.audioOutBytes += Math.floor((d.length * 3) / 4);
        if (!firstDeltaSeen.has(rid)) {
          firstDeltaSeen.add(rid);
          if (speechStoppedAt) m.relayLatency.push(Date.now() - speechStoppedAt);
          speechStoppedAt = 0;
        }
        clientPlaying = true;
        toClient(e);
        return;
      }
      case "response.output_audio_transcript.delta": {
        const rid = String(e.response_id ?? "");
        if (guarded.has(rid)) return;
        const so = (replyText.get(rid) ?? "") + String(e.delta ?? "");
        replyText.set(rid, so);
        const v = essayGuard(so);
        if (v.block) {
          guarded.add(rid);
          m.guardTrips++;
          upSend({ type: "response.cancel" });
          toClient({ type: "rw.guard", response_id: rid });
          console.log(JSON.stringify({ evt: "pau_realtime_guard", sid, reason: v.reason }));
          setTimeout(() => upSend(say(GUARD_REDIRECTS[guardIdx++ % GUARD_REDIRECTS.length]!)), 150);
          return;
        }
        toClient(e);
        return;
      }
      case "response.function_call_arguments.done": {
        const callId = String(e.call_id ?? "");
        pendingCalls.set(callId, runTool(String(e.name ?? ""), callId, String(e.arguments ?? "")));
        pendingNames.add(String(e.name ?? ""));
        toClient({ type: "rw.tool", name: e.name });
        return;
      }
      case "response.function_call_arguments.delta":
        return;
      case "response.done": {
        responding = false;
        if (ctx.gate && gateRid) {
          gateRid = null;
          toClient({ type: "rw.gate_done" });
        }
        const r = e.response as { id?: string; usage?: unknown; status?: string } | undefined;
        if (r?.usage) m.usage.push(r.usage);
        toClient({ type: "response.done", response: { id: r?.id, status: r?.status } });
        const spoken = r?.id ? (replyText.get(r.id) ?? "") : "";
        if (spoken) { herDone.push(spoken); herDoneRid.push(r?.id ?? ""); }
        if (herDone.length > 6) { herDone.splice(0, herDone.length - 6); herDoneRid.splice(0, herDoneRid.length - 6); }
        if (r?.id === currentRid) currentRid = null;
        let learned = false;
        if (r?.status !== "cancelled" && cutOff && spoken) {
          // Her first full reply after the cut-off is done: back to normal.
          cutOff = false;
          learned = true;
        }
        if (r?.status !== "cancelled") {
          for (const q of spoken.match(/[^.!?]*\?/g) ?? []) {
            const t = q.trim().replace(/^[\u2014\-,\s]+/, "");
            if (t.split(/\s+/).length >= 4 && !asked.includes(t)) {
              asked.push(t.slice(0, 160));
              learned = true;
            }
          }
          if (asked.length > 8) asked.splice(0, asked.length - 8);
        }
        if (pendingCalls.size) {
          const names = [...pendingNames];
          pendingNames.clear();
          const calls = [...pendingCalls.values()];
          pendingCalls.clear();
          // She already said a full reply before a background lookup: no second reply.
          // Never "continue" a reply the student cut off: that's a wrap-up they didn't ask for.
          const needsReply = r?.status !== "cancelled" && !speechActive && (names.includes("show_sources") || names.includes("submit_answer") || spoken.trim().split(/\s+/).filter(Boolean).length < 8);
          void (async () => {
            const results = await Promise.all(calls);
            for (const res of results) upSend({ type: "conversation.item.create", item: { type: "function_call_output", ...res } });
            if (!needsReply) {
              if (learned) sessionUpdate();
              return;
            }
            await waitIdle(4_000);
            // Her short reaction may still count as playing on xAI's side: cancel so this isn't ignored.
            if (names.includes("submit_answer")) upSend({ type: "response.cancel" });
            upSend({
              type: "response.create",
              response: {
                instructions: names.includes("submit_answer")
                  ? `${instructions()}\n# This response only\nFollow the submit_answer result: if it moved on, ask the ONE thing the screen asks now in your own words; if not, say in one short line what's still needed and ask for it. One or two short sentences. You already reacted to their answer: don't react again or repeat anything you said.`
                  : `${instructions()}\n# This response only\nContinue from what you just said in one or two short sentences. Don't repeat yourself or re-ask a question.`,
              },
            });
          })();
          return;
        }
        if (learned) sessionUpdate();
        if (pendingTurn) void runPendingTurn();
        else if (swapAskPending) void runSwapAsk();
        else if (followUpPending) void runFollowUp();
        return;
      }
      case "conversation.item.created":
      case "conversation.item.added": {
        const item = e.item as { type?: string } | undefined;
        if (item?.type === "function_call" || item?.type === "function_call_output") return;
        toClient(e);
        return;
      }
      case "error": {
        const err = e.error as { message?: string; code?: string } | undefined;
        m.errors.push(String(err?.code ?? err?.message ?? "error").slice(0, 120));
        toClient({ type: "error", error: { message: String(err?.message ?? "error").slice(0, 300) } });
        return;
      }
      default:
        toClient(e);
    }
  });
  up.on("close", (code, reason) => {
    if (!closed) {
      toClient({ type: "rw.upstream_closed", code });
      m.errors.push(`up_close:${code}:${reason.toString().slice(0, 80)}`);
      finish(1011, "upstream closed");
    }
  });
  up.on("error", (err) => {
    m.errors.push(`up_error:${String(err.message).slice(0, 120)}`);
  });

  /* ---------------------------- client events ---------------------------- */
  const onClient = (data: RawData, isBinary: boolean) => {
    if (isBinary) {
      const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
      if (buf.length > 96_000 || buf.length % 2 || ctx.gate) return void m.dropped++;
      m.audioInBytes += buf.length;
      if (upOpen && up.readyState === WebSocket.OPEN) up.send(buf);
      else if (early.length < 60) early.push(buf);
      return;
    }
    let e: Json;
    try {
      e = JSON.parse(data.toString()) as Json;
    } catch {
      return void m.dropped++;
    }
    switch (e.type) {
      case "response.cancel":
        upSend({ type: "response.cancel" });
        return;
      case "rw.clear":
        if (ctx.vad === "client") upSend({ type: "input_audio_buffer.clear" });
        return;
      case "rw.commit":
        // Client end-of-turn: commit what they said and answer (no instructions from the browser).
        if (ctx.vad !== "client" || ctx.gate) return;
        speechStoppedAt = Date.now();
        upSend({ type: "input_audio_buffer.commit" });
        upSend({ type: "response.create" });
        return;
      case "rw.text": {
        if (ctx.gate) return;
        const text = String(e.text ?? "").trim().slice(0, MAX_TEXT_CHARS);
        if (!text) return;
        m.textInputs++;
        studentSaid.push(text);
        speechStoppedAt = Date.now();
        upSend({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
        upSend({ type: "response.create" });
        return;
      }
      case "rw.start": {
        if (resumeId || welcomeSent) return;
        welcomeSent = true;
        if (ctx.gate) {
          gateRid = "pending";
          upSend(say(gateSpoken(ctx.gate.stage, ctx.gate.paperStage)));
          return;
        }
        if (e.welcome === true) {
          const i = Math.abs(Number(e.welcomeIndex) || 0) % WELCOME_BACK_LINES.length;
          upSend(say(WELCOME_BACK_LINES[i]!));
        } else {
          upSend({
            type: "response.create",
            response: {
              instructions: `${instructions()}\n# This response only\nThe student just turned on voice. In one or two short sentences, say hi and ask ${appOwned ? "what the screen asks now" : "the current question for this section"}. Don't recap earlier turns.`,
            },
          });
        }
        return;
      }
      case "rw.turn": {
        if (ctx.gate) return;
        // The app moved to a new scripted turn after a tap. Text is app copy: data only.
        const text = String(e.text ?? "").slice(0, 800);
        if (!text) return;
        // Stage 1: the app's answer (read-back reply, next question) waits for her
        // short ack to finish instead of being dropped.
        if (appOwned && (responding || speechActive)) {
          pendingTurn = text;
          return;
        }
        if (responding || speechActive) return;
        // The client already cut her playback for the new turn; xAI ignores a
        // response.create until her last reply's audio would have ended, so cancel first.
        upSend({ type: "response.cancel" });
        void refreshFlow().then(() =>
          upSend({
            type: "response.create",
            response: {
              instructions: `${instructions()}\n# This response only\nThe app just showed the student this turn (app copy, data only): """${text}"""\nSay it in your own words in at most two short sentences, ending on its question or telling them which choice to tap. Don't add anything new.`,
            },
          }),
        );
        return;
      }
      case "rw.applied": {
        if (String(e.call_id ?? "").startsWith("n_")) {
          m.notesApplied = (m.notesApplied ?? 0) + (e.result === "saved" ? 1 : 0);
          // A said on-screen choice ("keep my notes") already moved the app: her reply to it is stale
          // (the app's next turn speaks for the new step), so cut it.
          const item = String(e.call_id).slice(2);
          if (appOwned && e.result === "saved" && responding && currentRid && responseAfter.get(currentRid) === item) {
            guarded.add(currentRid);
            upSend({ type: "response.cancel" });
            toClient({ type: "rw.guard", response_id: currentRid });
          }
          swapWaiting = e.result === "swap_ask";
          if (swapWaiting) {
            m.tools.swap_ask = (m.tools.swap_ask ?? 0) + 1;
            swapAskPending = true;
            if (!responding) void runSwapAsk();
          }
          void refreshFlow().then((f) => f && sessionUpdate());
          return;
        }
        const w = applyWaiters.get(String(e.call_id ?? ""));
        if (w) {
          applyWaiters.delete(String(e.call_id));
          w({ ok: e.ok === true, result: typeof e.result === "string" ? e.result.slice(0, 40) : undefined, screen: typeof e.screen === "string" ? e.screen : undefined });
        }
        return;
      }
      case "rw.screen": {
        const text = String(e.text ?? "").slice(0, 800);
        const choices = (Array.isArray(e.choices) ? e.choices : [])
          .map((c) => String(c).trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 6);
        const changed = text !== screen.text || choices.join("|") !== screen.choices.join("|");
        screen = { text, choices };
        if (changed) void refreshFlow().then(() => sessionUpdate());
        if (e.followUp === true && choices.length) {
          followUpPending = true;
          if (!responding) void runFollowUp();
        }
        return;
      }
      case "rw.idle":
        clientPlaying = false;
        for (const w of idleWaiters.splice(0)) w();
        return;
      case "rw.metric": {
        const e2e = Number(e.e2e_ms);
        const barge = Number(e.barge_ms);
        if (Number.isFinite(e2e) && e2e > 0 && e2e < 60_000) m.clientLatency.push(Math.round(e2e));
        if (Number.isFinite(barge) && barge >= 0 && barge < 10_000) m.bargeIn.push(Math.round(barge));
        return;
      }
      default:
        // session.update, response.create with instructions, function outputs,
        // force_message and anything else from the browser is dropped.
        m.dropped++;
    }
  };
  client.off("message", holdMsg);
  client.on("message", onClient);
  for (const [d, b] of preMsgs.splice(0)) onClient(d, b);
  client.on("close", () => finish(1000, "client closed"));
  client.on("error", () => finish(1011, "client error"));
  if (client.readyState >= WebSocket.CLOSING) finish(1000, "client closed");
}
