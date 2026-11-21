"use client";

import { Button } from "@/components/ui/button";
import {
  MEMORY_TRIGGER_INTRO,
  type MemoryTrigger,
} from "@/lib/coaching/memoryTriggers";

type Props = {
  triggers: MemoryTrigger[];
  onPick: (trigger: MemoryTrigger) => void;
  onHide: (trigger: MemoryTrigger) => void;
  onSkip: () => void;
  activeLine?: string | null;
};

export function MemoryTriggerList({ triggers, onPick, onHide, onSkip, activeLine }: Props) {
  return (
    <div className="rounded-xl border border-rw-ink/15 bg-white p-4">
      <p className="text-sm text-rw-ink/75">{MEMORY_TRIGGER_INTRO}</p>
      <ul className="mt-3 space-y-3">
        {triggers.map((trigger) => (
          <li key={trigger.id} className="rounded-lg bg-rw-paper p-3">
            <p className="font-medium text-rw-ink">{trigger.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onPick(trigger)}>
                Show this idea
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onHide(trigger)}>
                Not this one
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {activeLine ? <p className="mt-3 text-sm text-rw-ink">{activeLine}</p> : null}
      <Button type="button" variant="ghost" className="mt-3" onClick={onSkip}>
        Skip these
      </Button>
    </div>
  );
}
