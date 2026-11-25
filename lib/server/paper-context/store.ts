import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PAPER_CONTEXT_FIELD,
  paperContextBlock,
  parseContext,
  type ContextExtras,
  type PaperContext,
} from "@/lib/stage1/paper-context";

/**
 * Server read/write of the paper-level context (RLS: the student's own client).
 * The block it builds is what Stage 2/3 prompts and the realtime relay load.
 */
export async function readPaperContext(supabase: SupabaseClient, paperId: string): Promise<PaperContext> {
  const { data } = await supabase
    .from("paper_autosaves")
    .select("draft_text")
    .eq("paper_id", paperId)
    .eq("field_key", PAPER_CONTEXT_FIELD)
    .maybeSingle();
  return parseContext(data?.draft_text ?? null);
}

/**
 * QA 10:21 suite (lost readback/decision): parallel brief calls (decision, leader,
 * confirm_readback) each read-modify-wrote the whole context, so the last one won and
 * erased the others. Writes are now compare-and-swap on updated_at, retried on a race.
 */
export async function writePaperContext(
  supabase: SupabaseClient,
  paperId: string,
  userId: string,
  update: (prev: PaperContext) => PaperContext,
): Promise<PaperContext> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row } = await supabase
      .from("paper_autosaves")
      .select("draft_text, updated_at")
      .eq("paper_id", paperId)
      .eq("field_key", PAPER_CONTEXT_FIELD)
      .maybeSingle();
    const prev = parseContext(row?.draft_text ?? null);
    const next = { ...update(prev), v: 1 as const };
    const now = new Date().toISOString();
    if (!row) {
      const { error } = await supabase.from("paper_autosaves").insert({
        paper_id: paperId,
        user_id: userId,
        field_key: PAPER_CONTEXT_FIELD,
        draft_text: JSON.stringify(next),
        submitted: true,
        updated_at: now,
      });
      if (!error) return next;
      if (error.code === "23505") continue; // another request created it first: merge into theirs
      throw new Error(`paper_context save: ${error.code ?? error.message}`);
    }
    const { data: done, error } = await supabase
      .from("paper_autosaves")
      .update({ draft_text: JSON.stringify(next), submitted: true, updated_at: now })
      .eq("paper_id", paperId)
      .eq("field_key", PAPER_CONTEXT_FIELD)
      .eq("updated_at", row.updated_at)
      .select("paper_id");
    if (error) throw new Error(`paper_context save: ${error.code ?? error.message}`);
    if (done && done.length) return next;
    // Lost the race: re-read and apply this change on top of the newer context.
    await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 60)));
  }
  // Never fail the student's step on contention: last-resort plain write (the old behavior).
  const prev = await readPaperContext(supabase, paperId);
  const next = { ...update(prev), v: 1 as const };
  const { error } = await supabase.from("paper_autosaves").upsert(
    { paper_id: paperId, user_id: userId, field_key: PAPER_CONTEXT_FIELD, draft_text: JSON.stringify(next), submitted: true, updated_at: new Date().toISOString() },
    { onConflict: "paper_id,field_key" },
  );
  if (error) throw new Error(`paper_context save: ${error.code ?? error.message}`);
  console.warn("[paper_context] CAS gave up after 8 tries", { paperId });
  return next;
}

type SavedSection = { title?: string; ideas?: string[]; status?: string };

/** Everything she knows: the stored context plus the student's own Stage 1 words and Stage 2 locked points. */
export async function loadContextExtras(supabase: SupabaseClient, paperId: string): Promise<ContextExtras> {
  const [saves, asg] = await Promise.all([
    supabase
      .from("paper_autosaves")
      .select("field_key, draft_text")
      .eq("paper_id", paperId)
      .in("field_key", ["stage1:stance_early", "stage1:personal_1", "stage1:coaching_take", "stage1:fallback_voice", "loop_session"]),
    supabase.from("assignments").select("story_angle").eq("paper_id", paperId).maybeSingle(),
  ]);
  const get = (k: string) => saves.data?.find((r) => r.field_key === k)?.draft_text?.trim() || null;
  let lockedPoints: ContextExtras["lockedPoints"] = [];
  try {
    const sess = JSON.parse(get("loop_session") ?? "{}") as { sections?: SavedSection[] };
    lockedPoints = (sess.sections ?? [])
      .filter((s) => s.status === "confirmed")
      .map((s) => ({ section: s.title ?? "Section", points: (s.ideas ?? []).filter((i) => i.trim()).slice(-2) }));
  } catch {
    lockedPoints = [];
  }
  const angle = (asg.data?.story_angle as { text?: string } | null)?.text?.trim() || null;
  return {
    earlyTake: get("stage1:stance_early"),
    ownAngle: angle,
    voiceSample: get("stage1:personal_1") ?? get("stage1:fallback_voice") ?? get("stage1:coaching_take"),
    lockedPoints,
  };
}

export async function loadPaperContextBlock(supabase: SupabaseClient, paperId: string): Promise<{ ctx: PaperContext; block: string }> {
  const [ctx, extras, shape] = await Promise.all([
    readPaperContext(supabase, paperId),
    loadContextExtras(supabase, paperId),
    // PC-28: ghost paper #1 tells her the paper's shape and which decisions are still needed.
    readShapeBlock(paperId),
  ]);
  const block = paperContextBlock(ctx, extras);
  return { ctx, block: shape ? `${block}\n${shape}` : block };
}

async function readShapeBlock(paperId: string): Promise<string> {
  try {
    const { readGhost, shapeDecisionsBlock } = await import("@/lib/server/skeleton/ghost");
    const row = await readGhost(paperId);
    return shapeDecisionsBlock(row?.shape ?? null);
  } catch {
    return "";
  }
}
