"use client";

import { useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { useChatPrefs } from "@/lib/voice/prefs";
import { needsTap, subscribeNeedsTap, unlockSpeech } from "@/lib/voice/speech";

/**
 * Shown when Pau Pau's audio could not start (a phone blocked playback, or the
 * engine stayed silent). The tap itself unlocks audio and replays her turn.
 */
export function TapToHear() {
  const { voice } = useChatPrefs();
  const blocked = useSyncExternalStore(subscribeNeedsTap, needsTap, () => false);
  if (!voice || !blocked) return null;
  return (
    <button
      type="button"
      data-tap-to-hear
      onClick={() => unlockSpeech()}
      className="ds-focus flex min-h-[48px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-ds-accent hover:bg-ds-page"
    >
      <Volume2 aria-hidden className="h-4 w-4" />
      Tap to hear Pau Pau
    </button>
  );
}
