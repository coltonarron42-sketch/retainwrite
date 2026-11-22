"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { bubbleIsSpeaking } from "@/lib/voice/presence";
import { useChatPrefs } from "@/lib/voice/prefs";
import { audibleSentence, subscribeAudible } from "@/lib/voice/speech";

/**
 * Pau Pau's presence (PLAN.md 9): a small flat face, Design System ink with
 * white eyes. `alive` adds an occasional glance and blink (pure CSS; none
 * under prefers-reduced-motion). Decorative only.
 */
export function PauFace({
  className,
  alive = false,
}: {
  className?: string;
  alive?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
      data-pau-face={alive ? "alive" : "still"}
    >
      <g className={alive ? "pp-tilt" : undefined}>
      <circle cx="20" cy="20" r="20" className="fill-ds-ink" />
      <g className={alive ? "pp-blink" : undefined}>
        <ellipse cx="13.5" cy="18" rx="4.2" ry="4.8" fill="#fff" />
        <ellipse cx="26.5" cy="18" rx="4.2" ry="4.8" fill="#fff" />
        <g className={alive ? "pp-glance" : undefined}>
          <circle cx="14" cy="18.6" r="2.5" className="fill-ds-ink" />
          <circle cx="26" cy="18.6" r="2.5" className="fill-ds-ink" />
          <circle cx="13.2" cy="17.6" r="0.8" fill="#fff" />
          <circle cx="25.2" cy="17.6" r="0.8" fill="#fff" />
        </g>
      </g>
      <path d="M9.5 10.6 Q13 9 16 10.3 M24 10.3 Q27 9 30.5 10.6" fill="none" stroke="#fff" strokeOpacity="0.92" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M16 27 Q20 28.2 24 27"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      </g>
    </svg>
  );
}

/** The sentence being said right now (start/end events), held briefly across sentence gaps. */
export function useAudibleSentence(): string | null {
  const now = useSyncExternalStore(
    subscribeAudible,
    audibleSentence,
    () => null,
  );
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    if (now) {
      setHeld(now);
      return;
    }
    // Between two sentences the engine is silent for a moment; don't flicker.
    const t = window.setTimeout(() => setHeld(null), 450);
    return () => window.clearTimeout(t);
  }, [now]);
  return now ?? held;
}

/** Is this bubble the one being read aloud? False whenever voice is off. */
export function useBubbleSpeaking(text: string): boolean {
  const { voice } = useChatPrefs();
  const sentence = useAudibleSentence();
  return voice && bubbleIsSpeaking(text, sentence);
}

/**
 * Soft wavy lines along the top and bottom edge of the bubble while Pau Pau's
 * voice is playing. Absolutely positioned: never moves the layout or the input.
 */
export function SpeakingWaves({ active }: { active: boolean }) {
  // Stay mounted a moment after she stops so the lines fade out.
  const [mounted, setMounted] = useState(active);
  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 450);
    return () => window.clearTimeout(t);
  }, [active]);
  if (!mounted) return null;
  const line =
    "M0 4 C 6 0, 10 0, 16.6 4 S 27 8, 33.3 4 S 44 0, 50 4 S 60 8, 66.6 4 S 77 0, 83.3 4 S 94 8, 100 4";
  return (
    <span
      aria-hidden
      data-pau-waves={active ? "on" : "fading"}
      className={cn(
        "pointer-events-none absolute inset-x-[20%] -inset-y-[10px] text-ds-accent",
        // A real 0.4s exit: kept mounted through it, then removed (QA 2:31 #5).
        active ? "pp-waves" : "pp-waves-out",
      )}
    >
      <svg
        className="pp-wave absolute inset-x-0 top-0 h-2 w-full"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="pp-wave pp-wave-late absolute inset-x-0 bottom-0 h-2 w-full"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
