export type SopEvent = { event: string };

export function voiceNudgeStats(events: SopEvent[]): {
  shown: number;
  reworkOpened: number;
  kept: number;
  nudgeRate: number | null;
} {
  const shown = events.filter((item) => item.event === "voice_nudge_shown").length;
  const reworkOpened = events.filter((item) => item.event === "voice_nudge_rework_opened").length;
  const kept = events.filter((item) => item.event === "voice_nudge_kept").length;
  const drafts = events.filter((item) => item.event === "revision_saved").length;
  return {
    shown,
    reworkOpened,
    kept,
    nudgeRate: drafts > 0 ? shown / drafts : null,
  };
}
