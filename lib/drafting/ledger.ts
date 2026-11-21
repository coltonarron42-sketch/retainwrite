// SOP: coaching only, never generate submission text — built from saved student data

import { createHash } from "node:crypto";
import { z } from "zod";

export const ledgerItemSchema = z.object({
  id: z.string(),
  sectionKey: z.string(),
  kind: z.enum([
    "idea",
    "memory",
    "leader",
    "style",
    "teach_aspect",
    "excerpt",
    "topic_sentence",
    "second_sentence_plan",
    "plan_row",
  ]),
  text: z.string().max(600),
  origin: z.enum(["student", "source"]),
  major: z.boolean().default(false),
});

export type LedgerItem = z.infer<typeof ledgerItemSchema>;

export const draftLedgerSchema = z.object({
  paperId: z.string(),
  version: z.number().int().min(1),
  promptType: z.enum(["lesson", "personal_experience", "mixed"]),
  paperGenre: z.string(),
  storyAngle: z.string(),
  thesis: z.string(),
  lessonConcept: z.string().nullable(),
  targetWords: z.number().int(),
  teacherWords: z.array(z.object({ rubricRef: z.string(), quote: z.string() })),
  sections: z.array(
    z.object({
      sectionKey: z.string(),
      title: z.string(),
      kind: z.string(),
      mode: z.enum(["lesson", "memory"]),
      items: z.array(ledgerItemSchema),
    }),
  ),
  sourceHash: z.string(),
});

export type DraftLedger = z.infer<typeof draftLedgerSchema>;

export type LedgerInputSection = {
  key: string;
  title: string;
  kind: string;
  mode: "lesson" | "memory";
  ideas: string[];
  chosenLead?: string | null;
  teachAspect?: string | null;
  claim?: string | null;
  excerpts?: string[];
};

export type LedgerInput = {
  paperId: string;
  promptType: "lesson" | "personal_experience" | "mixed";
  storyAngle: string;
  thesis: string;
  lessonConcept?: string | null;
  assignmentText?: string;
  sections: LedgerInputSection[];
  version?: number;
};

function item(
  sectionKey: string,
  kind: LedgerItem["kind"],
  text: string,
  origin: LedgerItem["origin"],
  major = false,
): LedgerItem | null {
  const value = text.trim();
  if (!value) return null;
  return {
    id: `${sectionKey}:${kind}:${value.slice(0, 24)}`,
    sectionKey,
    kind,
    text: value.slice(0, 600),
    origin,
    major,
  };
}

export function buildLedger(input: LedgerInput): DraftLedger {
  const sections = input.sections.map((section) => {
    const items = [
      ...section.ideas.map((idea) => item(section.key, "idea", idea, "student", true)),
      item(section.key, "leader", section.chosenLead ?? "", "student"),
      item(section.key, "teach_aspect", section.teachAspect ?? "", "student"),
      item(section.key, "topic_sentence", section.claim ?? "", "student", true),
      ...(section.excerpts ?? []).map((excerpt) => item(section.key, "excerpt", excerpt, "source")),
    ].filter((entry): entry is LedgerItem => Boolean(entry));
    return {
      sectionKey: section.key,
      title: section.title,
      kind: section.kind,
      mode: section.mode,
      items,
    };
  });
  const snapshot = {
    paperId: input.paperId,
    version: input.version ?? 1,
    promptType: input.promptType,
    paperGenre: "unknown",
    storyAngle: input.storyAngle.trim(),
    thesis: input.thesis.trim(),
    lessonConcept: input.lessonConcept?.trim() || null,
    targetWords: 0,
    teacherWords: [],
    sections,
  };
  const sourceHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return draftLedgerSchema.parse({ ...snapshot, sourceHash });
}

export function studentCorpus(input: LedgerInput): string {
  return [
    input.storyAngle,
    input.thesis,
    input.lessonConcept ?? "",
    input.assignmentText ?? "",
    ...input.sections.flatMap((section) => [
      section.claim ?? "",
      ...section.ideas,
      section.chosenLead ?? "",
      section.teachAspect ?? "",
      ...(section.excerpts ?? []),
    ]),
  ]
    .join("\n")
    .toLowerCase();
}

export function ledgerItemsAreVerbatim(ledger: DraftLedger, corpus: string): boolean {
  const haystack = corpus.toLowerCase();
  return ledger.sections.every((section) =>
    section.items.every((entry) => haystack.includes(entry.text.toLowerCase())),
  );
}

export function affectedParagraphKeys(
  previous: DraftLedger,
  next: DraftLedger,
): string[] {
  const changed: string[] = [];
  for (const section of next.sections) {
    const before = previous.sections.find((item) => item.sectionKey === section.sectionKey);
    const beforeText = JSON.stringify(before?.items ?? []);
    if (beforeText !== JSON.stringify(section.items)) changed.push(section.sectionKey);
  }
  return changed;
}
