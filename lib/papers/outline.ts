/** Overlay saved outline fields onto section notes. Later drafts replace the stance text. */
export function applyOutlineDrafts<T extends { key: string; ideas: string[] }>(
  sections: T[],
  drafts: { fieldKey: string; text: string }[],
): T[] {
  const byKey = new Map(
    drafts
      .filter((draft) => draft.fieldKey.startsWith("outline:"))
      .map((draft) => [draft.fieldKey.slice("outline:".length), draft.text]),
  );
  return sections.map((section) => {
    if (!byKey.has(section.key)) return section;
    const text = (byKey.get(section.key) ?? "").trim();
    return { ...section, ideas: text ? [text] : [] };
  });
}
