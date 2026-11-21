import "server-only";

import {
  hiddenDraftSignalsSchema,
  type HiddenDraftSignals,
  type MilestoneStatus,
} from "@/lib/drafting/hiddenPlan";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function readHiddenDraftMeta(paperId: string): Promise<
  | { found: false }
  | { found: true; ledgerHash: string; generations: number; signals: HiddenDraftSignals | null }
> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("get_hidden_draft_signals", { p_paper_id: paperId });
  if (error || !data || typeof data !== "object") return { found: false };
  const row = data as {
    found?: boolean;
    ledger_hash?: string;
    generations?: number;
    signals?: unknown;
  };
  if (!row.found || typeof row.ledger_hash !== "string" || typeof row.generations !== "number") {
    return { found: false };
  }
  const signals = hiddenDraftSignalsSchema.safeParse(row.signals);
  return {
    found: true,
    ledgerHash: row.ledger_hash,
    generations: row.generations,
    signals: signals.success ? signals.data : null,
  };
}

export async function writeHiddenDraft(input: {
  paperId: string;
  userId: string;
  mode: "prose" | "structure";
  ledgerHash: string;
  text: unknown;
  signals: HiddenDraftSignals;
  canary: string;
  trigger: "section_complete" | "outline_approved" | "draft_section_done";
  draftingComplete: boolean;
}): Promise<{ status: MilestoneStatus }> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("upsert_hidden_draft", {
    p_paper_id: input.paperId,
    p_user_id: input.userId,
    p_mode: input.mode,
    p_ledger_hash: input.ledgerHash,
    p_text: input.text,
    p_signals: input.signals,
    p_canary: input.canary,
    p_trigger: input.trigger,
    p_drafting_complete: input.draftingComplete,
  });
  if (error || !data || typeof data !== "object") throw new Error("store");
  const status = (data as { status?: string }).status;
  if (status === "stored" || status === "unchanged" || status === "capped") return { status };
  throw new Error("store");
}

/** Private text for the leak check. Never return this from a route. */
export async function loadHiddenDraftMaterial(
  paperId: string,
): Promise<{ text: string; canary: string } | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("load_hidden_draft_guard", { p_paper_id: paperId });
  if (error || !data || typeof data !== "object") return null;
  const row = data as { found?: boolean; text?: unknown; canary?: unknown };
  if (!row.found || row.text == null) return null;
  return {
    text: typeof row.text === "string" ? row.text : JSON.stringify(row.text),
    canary: typeof row.canary === "string" ? row.canary : "",
  };
}

export async function purgeHiddenDraftRows(): Promise<number> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("purge_hidden_drafts");
  if (error || typeof data !== "number") throw new Error("store");
  return data;
}
