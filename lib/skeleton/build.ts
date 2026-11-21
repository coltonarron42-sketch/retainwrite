// SOP: coaching only, never generate submission text
// Skeleton text is labels, the student's idea notes, and the student's own sentences.

export type SkeletonBlock = {
  key: string;
  label: string;
  status: "not_started" | "drafting" | "drafted";
  notes: string[];
  sentences: string[];
};

export function buildSkeleton(
  sections: { key: string; title: string; notes?: string[]; sentences?: string[] }[],
): SkeletonBlock[] {
  return sections.map((section) => {
    const sentences = section.sentences ?? [];
    const notes = (section.notes ?? []).map((note) => note.trim()).filter(Boolean);
    return {
      key: section.key,
      label: section.title,
      status: sentences.length ? "drafted" : notes.length ? "drafting" : "not_started",
      notes,
      sentences,
    };
  });
}

export function skeletonHasOnlyStudentText(
  blocks: SkeletonBlock[],
  allowed: string[],
): boolean {
  const haystack = allowed.join("\n").toLowerCase();
  return blocks.every((block) =>
    [...block.notes, ...block.sentences].every((line) => haystack.includes(line.toLowerCase())),
  );
}
