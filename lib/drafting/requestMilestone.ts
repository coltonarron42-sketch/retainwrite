// SOP: coaching only, never generate submission text
import { signedOut } from "@/lib/session/signedOut";

export type HiddenDraftMilestoneBody = {
  trigger: "section_complete" | "outline_approved" | "draft_section_done";
  draftingComplete?: boolean;
  stage?: number;
  promptType: "lesson" | "personal_experience" | "mixed";
  storyAngle: string;
  thesis: string;
  lessonConcept?: string | null;
  sections: { key: string; title: string; kind: string; ideas: string[] }[];
};

/** Fire-and-forget. A failed check never blocks the student. */
export function requestHiddenDraftMilestone(paperId: string, raw: HiddenDraftMilestoneBody) {
  if (signedOut()) return;
  // Trim to the route's limits so a long note never 400s.
  const body: HiddenDraftMilestoneBody = {
    ...raw,
    storyAngle: raw.storyAngle.slice(0, 2000),
    thesis: raw.thesis.slice(0, 2000),
    lessonConcept: raw.lessonConcept ? raw.lessonConcept.slice(0, 500) : raw.lessonConcept,
    sections: raw.sections.slice(0, 24).map((s) => ({
      key: s.key.slice(0, 80),
      title: s.title.slice(0, 80),
      kind: s.kind.slice(0, 40),
      ideas: s.ideas.slice(0, 20).map((i) => i.slice(0, 600)),
    })),
  };
  void fetch(`/api/papers/${paperId}/hidden-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}
