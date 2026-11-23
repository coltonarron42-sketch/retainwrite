"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Mic, MicOff } from "lucide-react";
import { RealtimeVoice, type RtPhase } from "@/lib/voice/realtime/client";
import { cn } from "@/lib/utils";

export type LiveTurn = { id: string; who: "you" | "pau"; text: string; cancelled?: boolean; saved?: boolean; sources?: { title: string; url: string; why?: string }[] };

/** Is the Grok Voice realtime PoC on for this student and paper? (server flag) */
export function useRealtimeEnabled(paperId: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/voice/realtime?paperId=${encodeURIComponent(paperId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j: { enabled?: boolean }) => live && setOn(j.enabled === true))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [paperId]);
  return on;
}

export type RealtimeCall = ReturnType<typeof useRealtimeCall>;

export function useRealtimeCall(opts: {
  paperId: string;
  saveNote: (text: string) => Promise<{ ok: boolean; result: string; screen?: string }>;
  welcome: () => { welcome: boolean; index: number; text?: string | null };
}) {
  const [phase, setPhase] = useState<RtPhase>("off");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveTurn[]>([]);
  const rt = useRef<RealtimeVoice | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const lastPau = useRef<string | null>(null);
  const welcomed = useRef(false);
  const welcomeText = useRef<string | null>(null);

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
    const voice = new RealtimeVoice(
      optsRef.current.paperId,
      {
        phase: setPhase,
        userCommitted: (id) => upsert(`u:${id}`, "you", (c) => c),
        userTranscript: (id, text) => upsert(`u:${id}`, "you", () => text),
        pauDelta: (rid, d) => {
          lastPau.current = rid;
          upsert(`p:${rid}`, "pau", (c) => c + d);
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
        },
        pauCancelled: (rid) => setLive((rows) => rows.filter((r) => r.id !== `p:${rid}`)),
        saveNote: async (_id, text, itemId) => {
          const r = await optsRef.current.saveNote(text);
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
      { welcome: w.welcome && !welcomed.current, welcomeIndex: w.index, effort, vad, tuning },
    );
    rt.current = voice;
    // The welcome-back line is said once per visit, never again on a restart.
    welcomed.current = true;
    welcomeText.current = w.welcome ? (w.text ?? null) : null;
    voice.setMuted(muted);
    void voice.start();
  }, [muted]);

  const stop = useCallback(() => {
    rt.current?.stop();
    rt.current = null;
    setPhase("off");
  }, []);

  useEffect(() => () => rt.current?.stop(), []);
  // A dropped call ends cleanly: text-only until they tap again.
  useEffect(() => {
    if (phase === "error") {
      rt.current?.stop();
      rt.current = null;
    }
  }, [phase]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      rt.current?.setMuted(!m);
      return !m;
    });
  }, []);

  return {
    phase,
    on: phase !== "off" && phase !== "error",
    muted,
    error,
    live,
    start,
    stop,
    toggleMute,
    sayTurn: (text: string) => rt.current?.sayTurn(text),
    setScreen: (text: string, choices: string[], followUp = false) => rt.current?.setScreen(text, choices, followUp),
    interrupt: () => rt.current?.interrupt(),
    level: () => rt.current?.level() ?? 0,
  };
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, "");

const STATUS: Record<RtPhase, string> = {
  off: "Talk with Pau Pau",
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
export function RealtimeControls({ call }: { call: RealtimeCall }) {
  return (
    <div className="flex min-w-0 items-center gap-1" data-rt-controls data-rt-phase={call.phase}>
      <button
        type="button"
        data-rt-call
        aria-pressed={call.on}
        aria-label={call.on ? "End voice with Pau Pau" : "Talk with Pau Pau"}
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
        {call.on && call.muted ? "Your mic is muted. Type, or unmute to talk." : call.error && !call.on ? call.error : STATUS[call.phase]}
      </span>
    </div>
  );
}
