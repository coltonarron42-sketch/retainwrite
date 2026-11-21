import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  fieldKey: z.string().min(1).max(120),
  text: z.string().max(50_000),
  submitted: z.boolean().optional(),
  resume: z
    .object({
      stage: z.number().int().min(1).max(6),
      sectionKey: z.string().max(80).nullable().optional(),
      questionId: z.string().max(80).nullable().optional(),
      screen: z.string().max(40).nullable().optional(),
    })
    .optional(),
  session: z.unknown().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

async function owner(paperId: string) {
  if (!z.string().uuid().safeParse(paperId).success) return null;
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: paper } = await supabase
    .from("papers")
    .select("id")
    .eq("id", paperId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!paper) return null;
  return { supabase, userId: user.id };
}

export async function GET(_request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  const auth = await owner(paperId);
  if (!auth) return NextResponse.json({ drafts: [], resume: null, session: null });
  const { data, error } = await auth.supabase
    .from("paper_autosaves")
    .select("field_key, draft_text, submitted")
    .eq("paper_id", paperId)
    .eq("user_id", auth.userId);
  if (error) {
    console.error("[autosave] load failed", { code: error.code, message: error.message });
    return NextResponse.json({ drafts: [], resume: null, session: null });
  }
  const rows = data ?? [];
  const sessionRow = rows.find((row) => row.field_key === "loop_session");
  let session: unknown = null;
  if (sessionRow?.draft_text) {
    try {
      session = JSON.parse(sessionRow.draft_text);
    } catch {
      session = null;
    }
  }
  const { data: paper } = await auth.supabase
    .from("papers")
    .select("resume")
    .eq("id", paperId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  return NextResponse.json({
    drafts: rows
      .filter((row) => row.field_key !== "loop_session")
      .map((row) => ({ fieldKey: row.field_key, text: row.draft_text, submitted: row.submitted })),
    resume: paper?.resume ?? null,
    session,
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  const auth = await owner(paperId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const { error } = await auth.supabase.from("paper_autosaves").upsert(
    {
      paper_id: paperId,
      user_id: auth.userId,
      field_key: body.fieldKey,
      draft_text: body.text,
      submitted: Boolean(body.submitted),
      updated_at: now,
    },
    { onConflict: "paper_id,field_key" },
  );
  if (error) {
    console.error("[autosave] write failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  if (body.session !== undefined) {
    const { error: sessionError } = await auth.supabase.from("paper_autosaves").upsert(
      {
        paper_id: paperId,
        user_id: auth.userId,
        field_key: "loop_session",
        draft_text: JSON.stringify(body.session),
        submitted: true,
        updated_at: now,
      },
      { onConflict: "paper_id,field_key" },
    );
    if (sessionError) {
      console.error("[autosave] session failed", { code: sessionError.code, message: sessionError.message });
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }
  if (body.resume) {
    const { data: existing } = await auth.supabase
      .from("papers")
      .select("current_stage")
      .eq("id", paperId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    const currentStage = existing?.current_stage ?? 1;
    const resumeMovesForward = body.resume.stage >= currentStage;
    const { error: resumeError } = await auth.supabase
      .from("papers")
      .update({
        ...(resumeMovesForward ? { resume: body.resume, current_stage: body.resume.stage } : {}),
        updated_at: now,
      })
      .eq("id", paperId)
      .eq("user_id", auth.userId);
    if (resumeError) {
      console.error("[autosave] resume failed", { code: resumeError.code, message: resumeError.message });
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
