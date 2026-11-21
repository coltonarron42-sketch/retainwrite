import "server-only";

// SOP: hidden scaffold — internal structure check only; never student-facing, never exported

export type HiddenSignals = {
  order: string[];
  flags: { ideaId: string; sectionKey: string; confidence: number }[];
};

/**
 * Build read-back signals from the student's own idea ids.
 * Any model text stays in this module and is not returned.
 */
export function signalsForReadback(
  ideas: { id: string; sectionKey: string }[],
): HiddenSignals {
  return {
    order: ideas.map((idea) => idea.id),
    flags: [],
  };
}

export function privateDraftText(ideas: { text: string }[]): string {
  return ideas.map((idea) => idea.text).join("\n");
}
