import "server-only";
import { hiddenSignalsFromIdeas } from "@/lib/drafting/hiddenSignals";

// SOP: hidden scaffold — internal structure check only; never student-facing, never exported

export function signalsForReadback(
  ideas: { id: string; text: string; sectionKey: string }[],
) {
  return {
    order: ideas.map((idea) => idea.id),
    signals: hiddenSignalsFromIdeas(ideas),
  };
}

/** Kept on the server. Never return this from a route. */
export function privateDraftText(ideas: { text: string }[]): string {
  return ideas.map((idea) => idea.text).join("\n");
}
