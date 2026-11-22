"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { setChatPref, useChatPrefs } from "@/lib/voice/prefs";
import {
  currentTurn,
  isSpeaking,
  speak,
  speechSupported,
  stopSpeech,
  subscribeSpeaking,
  installSpeechUnlock,
  takeNew,
  unlockSpeech,
  type SpeakItem,
} from "@/lib/voice/speech";
import { cn } from "@/lib/utils";

function useSupported() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    // Browser-only capability check after hydration.
    setSupported(speechSupported());
  }, []);
  return supported;
}

function useSpeaking() {
  return useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false);
}

/** Header switch: "Voice on / off". Stays on across bubbles, reloads and stages. */
export function VoiceToggle({ className }: { className?: string }) {
  const { voice } = useChatPrefs();
  const supported = useSupported();
  if (supported === null) return <span className={cn("min-h-[48px]", className)} aria-hidden />;
  if (!supported) {
    return (
      <span className={cn("text-[13px] leading-[1.6] text-ds-muted", className)} data-voice-unsupported>
        Read-aloud isn&apos;t available in this browser
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={voice}
      data-voice-toggle
      onClick={() => {
        const next = !voice;
        setChatPref("voice", next);
        if (next) {
          // Inside the tap: phones only allow speech that a gesture started.
          unlockSpeech();
          speak(currentTurn(), { interrupt: true });
        } else stopSpeech();
      }}
      className={cn(
        "ds-focus inline-flex min-h-[48px] items-center gap-2 rounded-full px-3 text-[14px] font-semibold transition-colors duration-150",
        voice ? "text-ds-accent" : "text-ds-muted hover:text-ds-ink",
        className,
      )}
    >
      {voice ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
      {voice ? "Voice on" : "Voice off"}
    </button>
  );
}

function useRecognitionSupported() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setOk(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);
  return ok;
}

/**
 * Voice call mute (PLAN.md 9): while Voice is on the student's mic listens
 * between Pau Pau's turns. Mute keeps it off (remembered on the account);
 * Pau Pau still speaks.
 */
export function MicMuteButton({ className }: { className?: string }) {
  const { voice, micMuted } = useChatPrefs();
  const canListen = useRecognitionSupported();
  if (!voice || !canListen) return null;
  return (
    <button
      type="button"
      data-mic-mute
      aria-pressed={micMuted}
      aria-label={micMuted ? "Unmute your mic" : "Mute your mic"}
      onClick={() => {
        unlockSpeech();
        setChatPref("micMuted", !micMuted);
      }}
      className={cn(
        "ds-focus inline-flex min-h-[48px] items-center gap-2 rounded-full px-3 text-[14px] font-semibold transition-colors duration-150",
        micMuted ? "bg-ds-ink text-white" : "text-ds-ink hover:bg-ds-surface",
        className,
      )}
    >
      {micMuted ? <MicOff aria-hidden className="size-5" /> : <Mic aria-hidden className="size-5" />}
      {micMuted ? "Unmute" : "Mute"}
    </button>
  );
}

/** Eyebrow row with the voice switch (and, on a voice call, Mute) on the right. */
export function ChatHeader({ eyebrow, eyebrowClassName }: { eyebrow: string; eyebrowClassName: string }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-2">
      <p className={eyebrowClassName}>{eyebrow}</p>
      <div className="flex items-center gap-1">
        <MicMuteButton />
        <VoiceToggle />
      </div>
    </div>
  );
}

/**
 * Reads newly arrived Pau Pau bubbles while voice is on. Renders nothing.
 * Pass only Pau Pau's own spoken sentences (never UI text or student text).
 */
export function SpeakNew({ scope, items }: { scope: string; items: SpeakItem[] }) {
  const { voice } = useChatPrefs();
  const sig = items.map((i) => `${i.key}\u0001${i.text}`).join("\u0002");
  useEffect(() => installSpeechUnlock(), []);
  useEffect(() => {
    const fresh = takeNew(scope, items);
    if (voice && fresh.length) speak(fresh.map((i) => i.text));
    // items are captured through `sig`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, sig, voice]);
  return null;
}

/** Small replay control under Pau Pau's current turn. */
export function ReplayButton({ texts, className }: { texts: string[]; className?: string }) {
  const supported = useSupported();
  const speaking = useSpeaking();
  if (!supported || !texts.length) return null;
  return (
    <button
      type="button"
      data-replay
      onClick={() => (speaking ? stopSpeech() : speak(texts, { interrupt: true }))}
      className={cn(
        "ds-focus inline-flex min-h-[48px] items-center gap-1 px-2 text-[13px] font-semibold text-ds-muted underline-offset-4 hover:text-ds-ink hover:underline",
        className,
      )}
    >
      <Volume2 aria-hidden className="size-4" />
      {speaking ? "Stop reading" : "Read aloud"}
    </button>
  );
}

/** Stop any reading when the intake unmounts (e.g. moving to Stage 2). */
export function useStopSpeechOnUnmount() {
  useEffect(() => () => stopSpeech(), []);
}
