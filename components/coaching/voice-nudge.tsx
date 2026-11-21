"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  describeTell,
  VOICE_NUDGE_HEADLINE,
  VOICE_NUDGE_KEEP,
  VOICE_NUDGE_MAKE,
  VOICE_NUDGE_NOTICED,
  voiceNudgeTips,
} from "@/lib/coaching/voiceNudge";
import type { MismatchResult } from "@/lib/style/mismatch";

type Props = {
  result: MismatchResult;
  section: string;
  part?: string;
  onKeep: () => void;
  onRework: () => void;
};

export function VoiceNudge({ result, section, part = "", onKeep, onRework }: Props) {
  const [open, setOpen] = useState(false);
  const [rework, setRework] = useState(false);
  const tips = voiceNudgeTips(result);

  return (
    <section className="rounded-xl border border-rw-ink/15 bg-white p-4" aria-label={`Voice nudge for ${section}`}>
      <p className="font-medium text-rw-ink">{VOICE_NUDGE_HEADLINE}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-rw-ink/80">
          {VOICE_NUDGE_NOTICED}
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rw-ink/75">
          {result.tells.map((tell) => (
            <li key={tell.signal}>{describeTell(tell, result.examples)}</li>
          ))}
        </ul>
      </details>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            setRework(true);
            setOpen(true);
            onRework();
          }}
        >
          {VOICE_NUDGE_MAKE}
        </Button>
        <Button type="button" variant="outline" onClick={onKeep}>
          {VOICE_NUDGE_KEEP}
        </Button>
      </div>
      {rework && open ? (
        <div className="mt-4 rounded-lg bg-rw-paper p-3 text-sm text-rw-ink/80">
          <p>Read this part aloud, then change anything that does not sound like you.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              if (typeof window === "undefined" || !("speechSynthesis" in window) || !part.trim()) return;
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(new SpeechSynthesisUtterance(part));
            }}
          >
            Read it aloud
          </Button>
        </div>
      ) : null}
    </section>
  );
}
