"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { bubbleIsSpeaking } from "@/lib/voice/presence";
import { useChatPrefs } from "@/lib/voice/prefs";
import { audibleEndedForGood, audibleSentence, subscribeAudible } from "@/lib/voice/speech";

/**
 * The official Pau Pau (PLAN.md 9, locked by Colton): a soft light-brown blob
 * head on cream, pink cat-eye glasses floating on it, simple dark eyes that
 * fill the frames, a tiny smile. Flat, inline SVG. `alive` adds an occasional
 * blink and a glance (the eyes move inside the frames; pure CSS, none under
 * prefers-reduced-motion). Decorative only.
 */
export const PAU_COLORS = {
  cream: "#F7EFE0",
  head: "#D2AE8A",
  headShade: "#C39A74",
  frame: "#E98BAA",
  lens: "#FBE3EA",
  eye: "#2A211C",
  smile: "#6B4A36",
} as const;

// Cat-eye lens (left); the right one is mirrored around x = 20.
const LENS = "M8.2 16.6 Q8.6 14.7 11.6 14.9 L16.9 15.4 Q18.7 15.7 18.5 17.8 Q18.1 22.4 13.9 22.6 Q9.7 22.7 8.7 19.4 Q8.2 17.9 8.2 16.6 Z";
const WING = "M8.4 16.2 L6.4 13.6";

export function PauFace({
  className,
  alive = false,
}: {
  className?: string;
  alive?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const clipL = `pp-l-${uid}`;
  const clipR = `pp-r-${uid}`;
  const c = PAU_COLORS;
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
      data-pau-face={alive ? "alive" : "still"}
      data-pau-character="blob-glasses"
    >
      <defs>
        <clipPath id={clipL}>
          <path d={LENS} />
        </clipPath>
        <clipPath id={clipR}>
          <path d={LENS} transform="matrix(-1 0 0 1 40 0)" />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="20" fill={c.cream} />
      {/* soft blob head */}
      <path
        d="M20 5.6 C28.6 5.2 34.7 11.2 34.6 19.8 C34.5 28.4 28.8 34.4 20.3 34.6 C11.6 34.8 5.4 29.2 5.3 20.5 C5.2 12 11.3 6 20 5.6 Z"
        fill={c.head}
      />
      <path d="M8.6 27.4 C11.5 32.2 16 34.4 20.3 34.4 C25.6 34.3 30 31.6 32.4 27.2 C28.6 30.6 24.6 31.8 20.2 31.8 C15.6 31.8 11.6 30.4 8.6 27.4 Z" fill={c.headShade} opacity="0.55" />
      {/* lens tint */}
      <path d={LENS} fill={c.lens} />
      <path d={LENS} transform="matrix(-1 0 0 1 40 0)" fill={c.lens} />
      {/* eyes fill the frames; they blink and glance inside them */}
      <g className={alive ? "pp-blink" : undefined}>
        <g clipPath={`url(#${clipL})`}>
          <g className={alive ? "pp-glance" : undefined}>
            <ellipse cx="13.5" cy="18.8" rx="3.9" ry="3.6" fill={c.eye} />
            <circle cx="12.4" cy="17.5" r="0.9" fill="#fff" />
          </g>
        </g>
        <g clipPath={`url(#${clipR})`}>
          <g className={alive ? "pp-glance" : undefined}>
            <ellipse cx="26.5" cy="18.8" rx="3.9" ry="3.6" fill={c.eye} />
            <circle cx="25.4" cy="17.5" r="0.9" fill="#fff" />
          </g>
        </g>
      </g>
      {/* pink cat-eye frames, floating */}
      <g fill="none" stroke={c.frame} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={LENS} />
        <path d={WING} />
        <path d={LENS} transform="matrix(-1 0 0 1 40 0)" />
        <path d={WING} transform="matrix(-1 0 0 1 40 0)" />
        <path d="M18.5 17.1 Q20 16 21.5 17.1" />
      </g>
      {/* tiny smile */}
      <path d="M18.1 26.6 Q20 27.9 21.9 26.6" fill="none" stroke={c.smile} strokeWidth="1.3" strokeLinecap="round" />
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
    // A real stop fades right away; between two sentences the engine is
    // silent for a moment, so hold briefly and don't flicker.
    const t = window.setTimeout(() => setHeld(null), audibleEndedForGood() ? 0 : 450);
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
