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

const DRAFT_STEPS = new Set(["opener", "read", "draft", "tighten"]);
const DRAFT_SCREENS = new Set<DraftScreen>(["zoomed_in", "milestone", "review_all", "jump_edit", "payoff"]);

/** A reload without this browser's storage still reopens the saved Drafting beat. */
export function draftBeatFromProgress(data: unknown): {
  sectionKey: string;
  step: "opener" | "read" | "draft" | "tighten";
  screen: DraftScreen;
} | null {
  if (!data || typeof data !== "object") return null;
  const record = data as { screen?: unknown; resumeBeat?: { sectionKey?: unknown; step?: unknown } };
  const sectionKey = record.resumeBeat?.sectionKey;
  const step = record.resumeBeat?.step;
  const screen = record.screen;
  if (typeof sectionKey !== "string" || !sectionKey) return null;
  if (typeof step !== "string" || !DRAFT_STEPS.has(step)) return null;
  if (typeof screen !== "string" || !DRAFT_SCREENS.has(screen as DraftScreen)) return null;
  return { sectionKey, step: step as "opener" | "read" | "draft" | "tighten", screen: screen as DraftScreen };
}
