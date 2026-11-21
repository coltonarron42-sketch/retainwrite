// SOP: coaching only, never generate submission text

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
export function requestHiddenDraftMilestone(paperId: string, body: HiddenDraftMilestoneBody) {
  void fetch(`/api/papers/${paperId}/hidden-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}
