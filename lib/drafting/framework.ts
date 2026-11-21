// SOP: coaching only, never generate submission text

import type { DraftLedger } from "@/lib/drafting/ledger";

export type ParagraphKind = "intro" | "body" | "counter" | "conclusion";

export type FrameworkParagraph = {
  key: string;
  sectionKey: string;
  title: string;
  kind: ParagraphKind;
  sortOrder: number;
  notes: string[];
  minWords: number;
};

const BODY_FLOOR = 50;
const INTRO_FLOOR = 60;

export function paragraphMinimum(kind: ParagraphKind, sectionCount: number): number {
  if (kind === "intro" || kind === "conclusion") return INTRO_FLOOR;
  const share = Math.floor(400 / Math.max(1, sectionCount));
  return Math.max(BODY_FLOOR, Math.min(share, 120));
}

export function buildFramework(
  ledger: DraftLedger,
  options?: { counterRequired?: boolean },
): FrameworkParagraph[] {
  const body = ledger.sections.filter(
    (section) => section.kind !== "intro" && section.kind !== "conclusion" && section.kind !== "counter",
  );
  const rows: FrameworkParagraph[] = [
    {
      key: "intro",
      sectionKey: "intro",
      title: "Introduction",
      kind: "intro",
      sortOrder: 0,
      notes: [],
      minWords: paragraphMinimum("intro", body.length),
    },
  ];
  body.forEach((section, index) => {
    rows.push({
      key: section.sectionKey,
      sectionKey: section.sectionKey,
      title: section.title,
      kind: "body",
      sortOrder: index + 1,
      notes: section.items.filter((item) => item.origin === "student").map((item) => item.text),
      minWords: paragraphMinimum("body", body.length),
    });
  });
  if (options?.counterRequired) {
    rows.push({
      key: "counter",
      sectionKey: "counter",
      title: "Counterargument",
      kind: "counter",
      sortOrder: rows.length,
      notes: [],
      minWords: paragraphMinimum("body", body.length),
    });
  }
  rows.push({
    key: "conclusion",
    sectionKey: "conclusion",
    title: "Conclusion",
    kind: "conclusion",
    sortOrder: rows.length,
    notes: [],
    minWords: paragraphMinimum("conclusion", body.length),
  });
  return rows;
}

export function promoteIdea(
  paragraphs: FrameworkParagraph[],
  sectionKey: string,
  note: string,
): { ok: true; paragraphs: FrameworkParagraph[] } | { ok: false; reason: string } {
  const inSection = paragraphs.filter((row) => row.sectionKey === sectionKey && row.kind === "body");
  if (inSection.length >= 3) return { ok: false, reason: "cap" };
  const next = [
    ...paragraphs,
    {
      key: `${sectionKey}:${inSection.length + 1}`,
      sectionKey,
      title: paragraphs.find((row) => row.sectionKey === sectionKey)?.title ?? sectionKey,
      kind: "body" as const,
      sortOrder: paragraphs.length,
      notes: [note],
      minWords: paragraphMinimum("body", inSection.length + 1),
    },
  ];
  return { ok: true, paragraphs: next };
}
