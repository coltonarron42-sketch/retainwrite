// SOP: coaching only, never generate submission text
// Pure planning for the private answer key. This file never calls the model
// and never returns prose to a student-facing caller.

import { z } from "zod";
import type { ReadbackFlag } from "@/lib/drafting/readback";

export const HIDDEN_DRAFT_CAP = 15;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const hiddenDraftSignalsSchema = z.object({
  version: z.number().int(),
  ledgerHash: z.string().max(128),
  placement: z
    .array(
      z.object({
        ideaId: z.string().max(120),
        currentSection: z.string().max(80),
        bestSection: z.string().max(80),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(40),
  pacing: z
    .array(
      z.object({
        sectionKey: z.string().max(80),
        ideaCount: z.number().int(),
        estWords: z.number().int(),
        targetWords: z.number().int(),
        status: z.enum(["light", "ok", "heavy"]),
      }),
    )
    .max(24),
  gaps: z
    .array(
      z.object({
        sectionKey: z.string().max(80),
        kind: z.enum(["no_idea", "no_evidence", "no_link_to_thesis", "no_landing"]),
      }),
    )
    .max(24),
  order: z.object({
    suggested: z.array(z.string().max(120)).max(40).nullable(),
    confidence: z.number().min(0).max(1),
  }),
  landing: z
    .array(
      z.object({
        ideaId: z.string().max(120),
        lands: z.enum(["yes", "weak", "no"]),
      }),
    )
    .max(40),
  sentenceWeight: z
    .array(
      z.object({
        sectionKey: z.string().max(80),
        planRowId: z.string().max(40),
        weight: z.enum(["light", "ok", "heavy"]),
      }),
    )
    .max(40),
});

export type HiddenDraftSignals = z.infer<typeof hiddenDraftSignalsSchema>;

const privateTextSchema = z.object({
  sections: z
    .array(
      z.object({
        sectionKey: z.string().max(80),
        paragraphs: z
          .array(
            z.object({
              text: z.string().max(2000),
              usesIdeaIds: z.array(z.string().max(120)).max(12),
            }),
          )
          .max(8),
      }),
    )
    .max(16),
});

const modelSchema = z.object({
  text: privateTextSchema,
  signals: hiddenDraftSignalsSchema,
});

export type MilestoneStatus = "stored" | "unchanged" | "capped" | "skipped" | "failed";

export async function runHiddenDraftWithDeps(input: {
  ledgerHash: string;
  meta: { ledgerHash: string; generations: number } | null;
  canary: string;
  mode: "prose" | "structure";
  model: () => Promise<{ ok: true; json: unknown } | { ok: false; reason: string }>;
  write: (row: {
    signals: HiddenDraftSignals;
    storedText: unknown | null;
    canary: string;
  }) => Promise<{ status: MilestoneStatus }>;
}): Promise<{ status: MilestoneStatus; reason?: string }> {
  const decision = milestoneDecision(input.meta, input.ledgerHash);
  if (decision.action === "skip") return { status: decision.status, reason: decision.status };
  let modeled: { ok: true; json: unknown } | { ok: false; reason: string };
  try {
    modeled = await input.model();
  } catch {
    return { status: "failed", reason: "request_failed" };
  }
  if (!modeled.ok) return { status: "failed", reason: modeled.reason.slice(0, 40) };
  const parsed = parseHiddenModel(modeled.json, input.ledgerHash, input.canary);
  if (!parsed.ok) return { status: "failed", reason: "schema" };
  try {
    const written = await input.write({
      signals: parsed.signals,
      storedText: input.mode === "structure" ? null : parsed.storedText,
      canary: input.canary,
    });
    return { status: written.status };
  } catch {
    return { status: "failed", reason: "store" };
  }
}

export function milestoneDecision(
  meta: { ledgerHash: string; generations: number } | null,
  ledgerHash: string,
): { action: "generate" } | { action: "skip"; status: "unchanged" | "capped" } {
  if (!meta) return { action: "generate" };
  if (meta.generations >= HIDDEN_DRAFT_CAP) return { action: "skip", status: "capped" };
  if (meta.ledgerHash === ledgerHash) return { action: "skip", status: "unchanged" };
  return { action: "generate" };
}

/** 30 days after Drafting ends, and never later than 90 days after the row was created. */
export function purgeAfter(created: Date, draftingEndedAt: Date | null): Date {
  const max = new Date(created.getTime() + 90 * DAY_MS);
  if (!draftingEndedAt) return max;
  const afterDraft = new Date(draftingEndedAt.getTime() + 30 * DAY_MS);
  return afterDraft < max ? afterDraft : max;
}

export function hiddenDraftPrompt(ledger: {
  thesis: string;
  storyAngle: string;
  sections: { sectionKey: string; title: string; items: { id: string; text: string }[] }[];
}): { system: string; user: string } {
  const system = [
    "You are RetainWrite's internal structure checker.",
    "Return one JSON object with keys text and signals.",
    "text is a private pacing check. It is never shown to the student.",
    "Do not address the student. Do not say you could say, here's a version, use this paragraph, or rewritten.",
    "signals hold ids, section keys, enums, and numbers only. No sentences.",
    "Use only the idea ids given. Do not invent ideas.",
  ].join(" ");
  const user = JSON.stringify({
    thesis: ledger.thesis,
    storyAngle: ledger.storyAngle,
    sections: ledger.sections.map((section) => ({
      sectionKey: section.sectionKey,
      title: section.title,
      ideas: section.items.map((item) => ({ id: item.id, text: item.text })),
    })),
  });
  return { system, user };
}

export function parseHiddenModel(
  json: unknown,
  ledgerHash: string,
  canary: string,
): { ok: true; signals: HiddenDraftSignals; storedText: unknown } | { ok: false; reason: "schema" } {
  const parsed = modelSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };
  const signals: HiddenDraftSignals = {
    ...parsed.data.signals,
    version: 1,
    ledgerHash,
  };
  if (JSON.stringify(signals).includes(canary)) return { ok: false, reason: "schema" };
  return {
    ok: true,
    signals,
    storedText: { ...parsed.data.text, marker: canary },
  };
}

function labelFor(key: string, labels?: Record<string, string>): string {
  const raw = (labels?.[key] ?? key).replace(/\s+/g, " ").trim();
  return raw.slice(0, 40) || "that section";
}

function reorderIdeas<T extends { id: string }>(ideas: T[], signals: HiddenDraftSignals | null): T[] {
  if (!signals || signals.order.confidence < 0.7 || !signals.order.suggested?.length) return ideas;
  const rank = new Map(signals.order.suggested.map((id, index) => [id, index]));
  const original = new Map(ideas.map((idea, index) => [idea.id, index]));
  return [...ideas].sort((a, b) => {
    const left = rank.has(a.id) ? rank.get(a.id)! : 1000 + (original.get(a.id) ?? 0);
    const right = rank.has(b.id) ? rank.get(b.id)! : 1000 + (original.get(b.id) ?? 0);
    return left - right;
  });
}

export function readbackFromSignals(input: {
  ideas: { id: string; text: string; sectionKey: string }[];
  signals: HiddenDraftSignals | null;
  labels?: Record<string, string>;
}): { ideas: { id: string; text: string; sectionKey: string }[]; flags: ReadbackFlag[] } {
  if (!input.signals) return { ideas: input.ideas, flags: [] };
  const ideas = reorderIdeas(input.ideas, input.signals);
  const flags: ReadbackFlag[] = [];

  for (const row of input.signals.placement) {
    if (flags.length >= 2) break;
    if (row.confidence < 0.7 || row.bestSection === row.currentSection) continue;
    if (!input.ideas.some((idea) => idea.id === row.ideaId)) continue;
    flags.push({
      kind: "placement",
      ideaId: row.ideaId,
      confidence: row.confidence,
      text: `This idea might land better in ${labelFor(row.bestSection, input.labels)}.`,
    });
  }

  for (const row of input.signals.sentenceWeight) {
    if (flags.length >= 2) break;
    if (row.weight !== "heavy") continue;
    const planRow = Number(row.planRowId);
    if (!Number.isInteger(planRow) || planRow < 1 || planRow > 30) continue;
    flags.push({
      kind: "weight",
      ideaId: row.planRowId,
      confidence: 0.8,
      text: `Your sentence ${planRow} plan carries a lot. Want to split that idea?`,
    });
  }

  const heavy = input.signals.pacing.find((row) => row.status === "heavy");
  const light = input.signals.pacing.find((row) => row.status === "light");
  if (flags.length < 2 && heavy && light && heavy.sectionKey !== light.sectionKey) {
    flags.push({
      kind: "pacing",
      ideaId: heavy.sectionKey,
      confidence: 0.8,
      text: `${labelFor(heavy.sectionKey, input.labels)} has a lot of ideas and ${labelFor(light.sectionKey, input.labels)} is light. Want to look at them?`,
    });
  }

  for (const gap of input.signals.gaps) {
    if (flags.length >= 2) break;
    const name = labelFor(gap.sectionKey, input.labels);
    flags.push({
      kind: "gap",
      ideaId: gap.sectionKey,
      confidence: 0.8,
      text:
        gap.kind === "no_evidence"
          ? `${name} doesn't have a source yet.`
          : `${name} doesn't have an idea yet.`,
    });
  }

  return { ideas, flags: flags.slice(0, 2) };
}

export function composeReadback(input: {
  ideas: { id: string; text: string; sectionKey: string }[];
  signals: HiddenDraftSignals | null;
  labels?: Record<string, string>;
  leakOk: boolean;
}): { ideas: { id: string; text: string; sectionKey: string }[]; flags: ReadbackFlag[] } {
  if (!input.leakOk) return { ideas: input.ideas, flags: [] };
  const shaped = readbackFromSignals(input);
  return { ideas: shaped.ideas, flags: shaped.flags.slice(0, 2) };
}

const LOG_KEYS = new Set(["version", "trigger", "mode", "ms", "reason", "surface", "rule", "count", "stage"]);

/** Counts, ids, and short codes only. Drops anything that could be draft prose. */
export function safeHiddenLogDetail(detail: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (!LOG_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    if (typeof value === "string" && value.length <= 40 && !value.includes(" ")) out[key] = value;
    if (typeof value === "string" && key === "trigger" && value.length <= 40) out[key] = value;
  }
  return out;
}
