/** Drafting shows the student's intro note and story answer, not the topic or the lesson header. */
export function draftingAnchors(input: {
  introNote?: string | null;
  storyAnswer?: string | null;
}): { mainPoint: string; story: string } {
  return {
    mainPoint: input.introNote?.trim() ?? "",
    story: input.storyAnswer?.trim() ?? "",
  };
}
