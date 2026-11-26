import { after, NextResponse } from "next/server";
import { refreshVoiceProfile } from "@/lib/server/voice/capture";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { guardStageMove, screenForStage } from "@/lib/stages/gate-guard";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentStage: z.number().int().min(1).max(6),
  progress: z
    .array(
      z.object({
        stage: z.number().int().min(1).max(6),
        status: z.enum(["locked", "in_progress", "complete"]),
      }),
    )
    .max(6),
  data: z.record(z.string(), z.unknown()).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) {
    return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Preserved gates: the server decides whether the paper may move (lib/stages/gate-guard.ts).
  const { data: paper } = await supabase
    .from("papers")
    .select("current_stage")
    .eq("id", paperId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const serverStage = (paper.current_stage as number | null) ?? 1;
  let session: unknown = null;
  if (body.currentStage > serverStage) {
    const { data: row } = await supabase
      .from("paper_autosaves")
      .select("draft_text")
      .eq("paper_id", paperId)
      .eq("user_id", user.id)
      .eq("field_key", "loop_session")
      .maybeSingle();
    try {
      session = row?.draft_text ? JSON.parse(row.draft_text) : null;
    } catch {
      session = null;
    }
  }
  const move = guardStageMove({ serverStage, requestedStage: body.currentStage, progress: body.progress, session: session as never });
  if (!move.ok) {
    console.warn(JSON.stringify({ evt: "stage_move_blocked", paper: paperId.slice(0, 8), from: serverStage, to: body.currentStage, reason: move.reason }));
    return NextResponse.json({ error: "Stage locked", reason: move.reason, currentStage: serverStage }, { status: 409 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("papers")
    .update({
      current_stage: move.currentStage,
      ...(move.advanced ? { resume: { stage: move.currentStage, screen: screenForStage(move.currentStage), at: Date.now() } } : {}),
      updated_at: now,
    })
    .eq("id", paperId)
    .eq("user_id", user.id);

  if (move.progress.length) {
    await supabase.from("stage_progress").upsert(
      move.progress.map((row) => ({
        paper_id: paperId,
        user_id: user.id,
        stage: row.stage,
        status: row.status,
        completed_at: row.status === "complete" ? now : null,
        ...(row.stage === 5 && body.data ? { data: body.data } : {}),
      })),
      { onConflict: "paper_id,stage" },
    );
  }
  // PC-32: each stage move folds that stage's answers into the background voice profile.
  if (move.advanced) {
    const uid = user.id;
    after(() => refreshVoiceProfile(supabase, paperId, uid, { reason: "stage_move" }));
  }

  return NextResponse.json({ ok: true });
}
