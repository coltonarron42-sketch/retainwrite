export type DraftScreen = "zoomed_in" | "milestone" | "review_all" | "jump_edit" | "payoff";

export type DraftEvent =
  | "section_saved"
  | "ready_next"
  | "review"
  | "jump"
  | "back"
  | "conclusion_saved"
  | "ghost_tap";

export function nextDraftScreen(state: DraftScreen, event: DraftEvent): DraftScreen {
  if (state === "zoomed_in" && event === "section_saved") return "milestone";
  if (state === "milestone" && event === "ready_next") return "zoomed_in";
  if (state === "milestone" && event === "review") return "review_all";
  if (state === "review_all" && event === "jump") return "jump_edit";
  if (state === "jump_edit" && (event === "back" || event === "section_saved")) return "zoomed_in";
  if (state === "review_all" && event === "ready_next") return "zoomed_in";
  if (state === "zoomed_in" && event === "conclusion_saved") return "payoff";
  if (state === "zoomed_in" && event === "ghost_tap") return "review_all";
  if (state === "payoff" && event === "jump") return "jump_edit";
  return state;
}

export type ResumeBeat = {
  stage: 5;
  sectionKey: string;
  step: string;
  paragraphKey: string;
};

export function resumeBeat(input: ResumeBeat): ResumeBeat {
  return input;
}
