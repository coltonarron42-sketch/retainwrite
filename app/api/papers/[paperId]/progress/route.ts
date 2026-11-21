import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

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

  const now = new Date().toISOString();
  await supabase
    .from("papers")
    .update({ current_stage: body.currentStage, updated_at: now })
    .eq("id", paperId)
    .eq("user_id", user.id);

  if (body.progress.length) {
    await supabase.from("stage_progress").upsert(
      body.progress.map((row) => ({
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

  return NextResponse.json({ ok: true });
}
