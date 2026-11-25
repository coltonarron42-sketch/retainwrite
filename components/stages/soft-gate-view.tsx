"use client";

import { Button } from "@/components/ui/button";
import { PauPauBubble } from "@/components/stages/stage1/chat-bubbles";
import { useGateVoice, useRealtimeEnabled } from "@/components/stages/loop/realtime-voice";
import { gateParas } from "@/lib/stages/soft-gate";
import { STAGE_LABELS } from "@/lib/config";

/** One line per stage for the inactive look under the gate. */
const STAGE_PREVIEWS = [
  "Intake: share the assignment and a little about how you write.",
  "Stance: find what you think, section by section, and lock it in.",
  "Outline: your locked-in ideas become the skeleton of the whole paper.",
  "Sources: find and check the sources that back up each section.",
  "Drafting: write each paragraph yourself, with Pau coaching.",
  "Revise: tighten your draft and get it ready to hand in.",
];

/**
 * A later stage, soft-gated (Colton, Nov 23): Pau's scripted overview and what
 * we still need, a way back, and an inactive look. No stage component is mounted,
 * so nothing here can write data or move the paper; the server gates stay hard.
 */
export function SoftGateView({ paperId, stage, paperStage }: { paperId: string; stage: number; paperStage: number }) {
  const rtOn = useRealtimeEnabled(paperId);
  const phase = useGateVoice(paperId, stage, rtOn);
  const paras = gateParas(stage, paperStage);
  return (
    <div className="mx-auto w-full max-w-[728px] flex-1 px-6 pb-12 pt-4 font-ds-sans text-ds-ink" data-stage-view="ahead" data-gate-voice={phase}>
      <p className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-ds-muted">
        Stage {stage} · {STAGE_LABELS[stage - 1]}
      </p>
      <PauPauBubble as="div">
        <div data-soft-gate className="space-y-3">
          {paras.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </PauPauBubble>
      <Button asChild className="mt-6">
        {/* A plain link (full load), not client nav: the way back must always work. */}
        <a href={`/app/papers/${paperId}/stage/${paperStage}`} data-stage-back>
          Back to Stage {paperStage}: {STAGE_LABELS[paperStage - 1] ?? ""}
        </a>
      </Button>
      <div inert className="mt-8 rounded-[12px] border border-ds-border p-4 opacity-60" aria-label="Preview, not active yet">
        <p className="text-[15px] leading-[1.6] text-ds-muted">{STAGE_PREVIEWS[stage - 1]}</p>
        <textarea
          disabled
          rows={2}
          className="mt-3 w-full resize-none rounded-[8px] border border-ds-border bg-transparent p-2 text-[15px]"
          placeholder="Pau opens here once the earlier stage is done."
        />
      </div>
    </div>
  );
}
