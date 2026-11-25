"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Mic, MicOff } from "lucide-react";
import { RealtimeVoice, type RtPhase } from "@/lib/voice/realtime/client";
import { cn } from "@/lib/utils";

export type LiveTurn = { id: string; who: "you" | "pau"; text: string; cancelled?: boolean; saved?: boolean; echo?: boolean; sources?: { title: string; url: string; why?: string }[] };

/** An earlier Pau row whose words the newest row repeats (its whole text, at its end) is dropped. */
export function dedupePau(rows: LiveTurn[], id: string): LiveTurn[] {
  const cur = rows.find((r) => r.id === id);
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const a = cur ? key(cur.text) : "";
  if (!a) return rows;
  const out = rows.filter((r) => r === cur || r.who !== "pau" || key(r.text).length < 12 || !a.endsWith(key(r.text)));
  return out.length === rows.length ? rows : out;
}

/** Is the Grok Voice realtime PoC on for this student and paper? (server flag) */
/** Voice on for this tab (kept across stage pages): a soft gate speaks its line only then. */
const RT_ON_KEY = "rw:rt:on";
const RT_MUTED_KEY = "rw:rt:muted";
function rememberVoice(on: boolean, muted?: boolean) {
  try {
    if (on) sessionStorage.setItem(RT_ON_KEY, "1");
    else sessionStorage.removeItem(RT_ON_KEY);
    if (muted !== undefined) {
      if (muted) sessionStorage.setItem(RT_MUTED_KEY, "1");
      else sessionStorage.removeItem(RT_MUTED_KEY);
    }
  } catch {}
}
export function voiceWasOn(): boolean {
  try {
    return sessionStorage.getItem(RT_ON_KEY) === "1" && sessionStorage.getItem(RT_MUTED_KEY) !== "1";
  } catch {
    return false;
  }
}

/**
 * The soft gate's scripted line on a Grok Voice call (Colton, Nov 23): spoken once
 * per visit when voice was on and the mic isn't muted; text-only otherwise. Speak-only
 * session (no mic, no notes); the relay ends it after the line.
 */
export function useGateVoice(paperId: string, stage: number, enabled: boolean) {
  const spoken = useRef(false);
  const [phase, setPhase] = useState<RtPhase>("off");
  useEffect(() => {
    if (!enabled || spoken.current || !voiceWasOn()) return;
    spoken.current = true;
    const w = window as unknown as { __rwGate?: { sessions: number; text: string } };
    w.__rwGate ??= { sessions: 0, text: "" };
    w.__rwGate.sessions++;
    const voice = new RealtimeVoice(
      paperId,
      {
        phase: setPhase,
        pauDelta: (_rid, d) => {
          w.__rwGate!.text += d;
        },
        error: () => undefined,
      },
      { welcome: false, welcomeIndex: 0, gate: stage },
    );
    void voice.start();
    return () => voice.stop();
  }, [enabled, paperId, stage]);
  return phase;
}

/** Grok Voice for this paper: null while the server flag is still loading. */
export function useRealtimeFlag(paperId: string): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/voice/realtime?paperId=${encodeURIComponent(paperId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j: { enabled?: boolean }) => live && setOn(j.enabled === true))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
  }, [paperId]);
  return on;
}

export function useRealtimeEnabled(paperId: string): boolean {
  return useRealtimeFlag(paperId) === true;
}

export type RealtimeCall = ReturnType<typeof useRealtimeCall>;

export function useRealtimeCall(opts: {
  paperId: string;
  saveNote: (text: string, kind?: string) => Promise<{ ok: boolean; result: string; screen?: string; spoken?: string }>;
  welcome: () => { welcome: boolean; index: number; text?: string | null };
  /** 1 on Stage 1 (Intake); Stage 2 otherwise. */
  stage?: 1 | 2 | 3;
}) {
  const [phase, setPhase] = useState<RtPhase>("off");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveTurn[]>([]);
  // PC-29: the mic pauses while they type (one input channel at a time).
  const [typing, setTyping] = useState(false);
  const rt = useRef<RealtimeVoice | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const lastPau = useRef<string | null>(null);
  const welcomed = useRef(false);
  const welcomeText = useRef<string | null>(null);
  /** The last few on-screen prompts the app had her say word for word (Stage 1). */
  const prompts = useRef<string[]>([]);
  const notePrompt = (t?: string) => {
    const v = t?.trim();
    if (!v || prompts.current.includes(v)) return;
    prompts.current = [...prompts.current, v].slice(-3);
  };

  const upsert = (id: string, who: LiveTurn["who"], fn: (cur: string) => string, extra?: Partial<LiveTurn>) =>
    setLive((rows) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return [...rows, { id, who, text: fn(""), ...extra }];
      const next = [...rows];
      next[i] = { ...next[i]!, text: fn(next[i]!.text), ...extra };
      return next;
    });

  const start = useCallback(() => {
    if (rt.current) return;
    setError(null);
    const w = optsRef.current.welcome();
    const params = typeof window !== "undefined" ? new URLSearchParams(location.search) : null;
    const effort = params?.get("rtEffort") === "high" ? "high" : undefined;
    const vad = params?.get("rtVad") === "client" ? "client" : "server";
    // Test-only VAD tuning passthrough (validated on the server).
    const tuning: Record<string, string> = {};
    for (const k of ["sil", "thr"]) {
      const v = params?.get(`rt_${k}`);
      if (v) tuning[k] = v;
    }
    // A fresh call starts a fresh live transcript (the chat history keeps what was saved).
    setLive([]);
    const voice = new RealtimeVoice(
      optsRef.current.paperId,
      {
        phase: setPhase,
        userCommitted: (id) => upsert(`u:${id}`, "you", (c) => c),
        userTranscript: (id, text) => upsert(`u:${id}`, "you", () => text),
        pauDelta: (rid, d) => {
          lastPau.current = rid;
          upsert(`p:${rid}`, "pau", (c) => c + d);
          // PC-29 QA round 3 minor: the same prompt said again (voice back on, a re-said step) shows once.
          setLive((rows) => dedupePau(rows, `p:${rid}`));
          // The welcome-back line already shows once at the top of the return; no copy below.
          const wt = welcomeText.current;
          if (wt)
            setLive((rows) => {
              const row = rows.find((x) => x.id === `p:${rid}`);
              if (!row) return rows;
              const a = norm(row.text);
              const b = norm(wt);
              if (a === b) {
                welcomeText.current = null;
                return rows.filter((x) => x !== row);
              }
              const hide = b.startsWith(a);
              if (!hide) welcomeText.current = null;
              return rows.map((x) => (x === row ? { ...x, saved: hide } : x));
            });
          // PC-29 follow-up: her word-for-word on-screen prompt (Stage 1) is already on the page;
          // no copy of it lingers in the voice transcript (e.g. below "Start stance interview").
          if (prompts.current.length) setLive((rows) => hidePromptEcho(rows, `p:${rid}`, prompts.current));
        },
        echo: (itemId) => setLive((rows) => rows.map((x) => (x.id === `u:${itemId}` ? { ...x, saved: true } : x))),
        pauCancelled: (rid) => setLive((rows) => rows.filter((r) => r.id !== `p:${rid}`)),
        pauDropped: (rid) => setLive((rows) => rows.filter((r) => r.id !== `p:${rid}`)),
        typing: setTyping,
        saveNote: async (_id, text, itemId, kind) => {
          const r = await optsRef.current.saveNote(text, kind);
          // Saved words already show in the chat history as their message.
          if (r.result === "saved" && itemId) setLive((rows) => rows.map((x) => (x.id === `u:${itemId}` ? { ...x, saved: true } : x)));
          return r;
        },
        sources: (links) => {
          const rid = lastPau.current ?? `s${Date.now()}`;
          upsert(`p:${rid}`, "pau", (c) => c, { sources: links });
        },
        error: (m) => setError(m),
        metric: (m) => {
          const w2 = window as unknown as { __rwRt?: { e2e: number[]; barge: number[] } };
          w2.__rwRt ??= { e2e: [], barge: [] };
          if (m.e2eMs !== undefined) w2.__rwRt.e2e.push(m.e2eMs);
          if (m.bargeMs !== undefined) w2.__rwRt.barge.push(m.bargeMs);
        },
      },
      { welcome: w.welcome && !welcomed.current, welcomeIndex: w.index, welcomeText: w.text ?? null, effort, vad, tuning, stage: optsRef.current.stage },
    );
    rt.current = voice;
    // The welcome-back line is said once per visit, never again on a restart.
    welcomed.current = true;
    welcomeText.current = w.welcome ? (w.text ?? null) : null;
    voice.setMuted(muted);
    rememberVoice(true, muted);
    void voice.start();
  }, [muted]);

  const stop = useCallback(() => {
    rememberVoice(false);
    rt.current?.stop();
    rt.current = null;
    setPhase("off");
    // The call is over: nothing from it lingers under the chat.
    setLive([]);
  }, []);

  useEffect(() => () => rt.current?.stop(), []);
  // A dropped call ends cleanly: text-only until they tap again.
  useEffect(() => {
    if (phase === "error") {
      rememberVoice(false);
      rt.current?.stop();
      rt.current = null;
    }
  }, [phase]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      rt.current?.setMuted(!m);
      if (rt.current) rememberVoice(true, !m);
      return !m;
    });
  }, []);

  return {
    phase,
    on: phase !== "off" && phase !== "error",
    muted,
    typing,
    error,
    live,
    start,
    stop,
    toggleMute,
    sayTurn: (text: string, opts?: { detail?: boolean; spoken?: string }) => {
      notePrompt(opts?.spoken);
      return rt.current?.sayTurn(text, opts);
    },
    setScreen: (text: string, choices: string[], followUp = false, spoken?: string) => {
      notePrompt(spoken);
      return rt.current?.setScreen(text, choices, followUp, spoken);
    },
    interrupt: () => rt.current?.interrupt(),
    clearLive: () => setLive([]),
    level: () => rt.current?.level() ?? 0,
  };
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, "");

/** A Pau row that is (so far) one of the on-screen prompts, or ends with one (a welcome line + the prompt), is hidden. */
export function hidePromptEcho(rows: LiveTurn[], id: string, prompts: string[]): LiveTurn[] {
  const row = rows.find((r) => r.id === id);
  if (!row || row.who !== "pau") return rows;
  const a = norm(row.text);
  if (!a) return rows;
  const ps = prompts.map(norm).filter((p) => p.length >= 12);
  // Her transcript of a prompt drifts a little from the copy ("1,200-1,500" → "1200 to 1500"):
  // a row of 5+ words that is almost all the prompt's own words counts too.
  const words = (t: string) => t.toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const rw = words(row.text);
  const close = (p: string) => {
    if (rw.length < 5) return false;
    const pw = new Set(words(p));
    return rw.filter((w) => pw.has(w)).length / rw.length >= 0.85;
  };
  const hide = ps.some((p) => p.startsWith(a) || a.endsWith(p)) || prompts.some(close);
  if (hide && !row.saved) return rows.map((x) => (x === row ? { ...x, saved: true, echo: true } : x));
  // Only a row this hid comes back (it turned out to be her own words, not the prompt).
  if (!hide && row.echo) return rows.map((x) => (x === row ? { ...x, saved: false, echo: false } : x));
  return rows;
}

const STATUS: Record<RtPhase, string> = {
  off: "Talk with Pau",
  connecting: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Voice off. Type, or tap to retry",
};

/** Four bars driven by her real output level (prefers-reduced-motion: still). */
function Waves({ call }: { call: RealtimeCall }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (!call.on) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = (t: number) => {
      const lv = reduce ? 0 : call.level();
      refs.current.forEach((el, i) => {
        if (!el) return;
        const wob = 0.6 + 0.4 * Math.sin(t / (90 + i * 37) + i);
        const base = call.phase === "listening" ? 0.45 + 0.1 * Math.sin(t / 400 + i) : 0.4;
        el.style.transform = `scaleY(${Math.max(base, Math.min(1, lv * wob * 1.6))})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [call, call.on, call.phase]);
  return (
    <span aria-hidden className={cn("flex h-4 items-center gap-[2px]", call.phase === "connecting" || call.phase === "thinking" ? "opacity-75" : "")}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} ref={(el) => void (refs.current[i] = el)} className="block h-4 w-[3px] origin-center rounded-full bg-current" style={{ transform: "scaleY(0.4)" }} />
      ))}
    </span>
  );
}

/** Composer row controls: start/end the call (waveform), Mute, and the status line. */
export function RealtimeControls({ call, listenHint }: { call: RealtimeCall; listenHint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1" data-rt-controls data-rt-phase={call.phase} data-rt-typing={call.on && call.typing ? "" : undefined}>
      <button
        type="button"
        data-rt-call
        aria-pressed={call.on}
        aria-label={call.on ? "End voice with Pau" : "Talk with Pau"}
        className={cn(
          "ds-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
          call.on ? "bg-ds-accent text-white" : "text-ds-accent hover:bg-ds-page",
        )}
        onClick={() => (call.on ? call.stop() : call.start())}
      >
        {call.on ? <Waves call={call} /> : <AudioLines aria-hidden className="h-5 w-5" />}
      </button>
      {call.on ? (
        <button
          type="button"
          data-mic-mute
          aria-pressed={call.muted}
          aria-label={call.muted ? "Unmute your mic" : "Mute your mic"}
          onClick={call.toggleMute}
          className={cn(
            "ds-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
            call.muted ? "bg-ds-ink text-white" : "text-ds-ink hover:bg-ds-page",
          )}
        >
          {call.muted ? <MicOff aria-hidden className="h-5 w-5" /> : <Mic aria-hidden className="h-5 w-5" />}
        </button>
      ) : null}
      <span className="min-w-0 truncate px-1 text-[13px] leading-[1.4] text-ds-muted" role="status" data-rt-status>
        {call.on && call.muted ? "Your mic is muted. Type, or unmute to talk." : call.on && call.typing ? "Typing — mic paused" : call.error && !call.on ? call.error : call.on && call.phase === "listening" && listenHint ? listenHint : STATUS[call.phase]}
      </span>
    </div>
  );
}
