import "server-only";

import { randomBytes } from "node:crypto";
import { grokChatJson, hasGrokKey, MODEL_STRONG } from "@/lib/ai/grok";
import { FEATURES, HIDDEN_DRAFT_MODE } from "@/lib/config";
import { buildLedger, type LedgerInput } from "@/lib/drafting/ledger";
import {
  hiddenDraftPrompt,
  runHiddenDraftWithDeps,
  safeHiddenLogDetail,
  type MilestoneStatus,
} from "@/lib/drafting/hiddenPlan";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readHiddenDraftMeta, writeHiddenDraft } from "@/lib/server/hiddenDraft/store";

// SOP: hidden scaffold — internal structure check only; never student-facing, never exported

export type HiddenDraftTrigger = "section_complete" | "outline_approved" | "draft_section_done";

function logHidden(event: string, detail: Record<string, unknown>) {
  console.info(`[${event}]`, safeHiddenLogDetail(detail));
}

async function grokHiddenModel(system: string, user: string) {
  if (!hasGrokKey()) return { ok: false as const, reason: "missing_key" };
  // SOP: hidden scaffold — internal structure check only; never student-facing, never exported
  // Low reasoning effort: the request ran at the default (high) effort and took ~20s.
  const res = await grokChatJson({ model: MODEL_STRONG, system, user, reasoningEffort: "low", timeoutMs: 30_000 });
  if (!res.ok) return { ok: false as const, reason: res.reason };
  try {
    return { ok: true as const, json: JSON.parse(res.text) as unknown };
  } catch {
    return { ok: false as const, reason: "invalid_json" };
  }
}

export async function runHiddenDraftMilestone(input: {
  paperId: string;
  userId: string;
  trigger: HiddenDraftTrigger;
  ledger: LedgerInput;
  draftingComplete: boolean;
  stage: number;
}): Promise<{ status: MilestoneStatus }> {
  if (!FEATURES.hiddenDraft) {
    logHidden("hidden_draft_skipped", { reason: "flag_off", trigger: input.trigger, stage: input.stage });
    return { status: "skipped" };
  }
  if (input.stage < 2) {
    logHidden("hidden_draft_skipped", { reason: "stage", trigger: input.trigger, stage: input.stage });
    return { status: "skipped" };
  }

  const started = Date.now();
  const ledger = buildLedger(input.ledger);
  const prompt = hiddenDraftPrompt({
    thesis: ledger.thesis,
    storyAngle: ledger.storyAngle,
    sections: ledger.sections.map((section) => ({
      sectionKey: section.sectionKey,
      title: section.title,
      items: section.items
        .filter((item) => item.origin === "student")
        .map((item) => ({ id: item.id, text: item.text })),
    })),
  });
  const canary = `rwcanary${randomBytes(8).toString("hex")}`;

  let meta: { ledgerHash: string; generations: number } | null = null;
  try {
    const existing = await readHiddenDraftMeta(input.paperId);
    if (existing.found) meta = { ledgerHash: existing.ledgerHash, generations: existing.generations };
  } catch {
    logHidden("hidden_draft_failed", { reason: "store", trigger: input.trigger });
    return { status: "failed" };
  }

  const result = await runHiddenDraftWithDeps({
    ledgerHash: ledger.sourceHash,
    meta,
    canary,
    mode: HIDDEN_DRAFT_MODE,
    model: () => grokHiddenModel(prompt.system, prompt.user),
    write: async (row) =>
      writeHiddenDraft({
        paperId: input.paperId,
        userId: input.userId,
        mode: HIDDEN_DRAFT_MODE,
        ledgerHash: ledger.sourceHash,
        text: row.storedText,
        signals: row.signals,
        canary: row.canary,
        trigger: input.trigger,
        draftingComplete: input.draftingComplete,
      }),
  });

  if (result.status === "stored") {
    const detail = safeHiddenLogDetail({
      trigger: input.trigger,
      mode: HIDDEN_DRAFT_MODE,
      ms: Date.now() - started,
      stage: input.stage,
    });
    logHidden("hidden_draft_generated", detail);
    try {
      const service = createServiceRoleClient();
      await service.from("session_events").insert({
        user_id: input.userId,
        paper_id: input.paperId,
        stage: input.stage,
        event: "hidden_draft_generated",
        detail,
      });
    } catch {
      /* logging never blocks */
    }
  } else if (result.status === "failed") {
    const reason = result.reason && /^[a-z0-9_]{1,40}$/.test(result.reason) ? result.reason : "failed";
    logHidden("hidden_draft_failed", { reason, trigger: input.trigger });
  } else {
    logHidden("hidden_draft_skipped", { reason: result.status, trigger: input.trigger });
  }

  return { status: result.status };
}
