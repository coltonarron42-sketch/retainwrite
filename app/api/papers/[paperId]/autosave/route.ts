import { after, NextResponse } from "next/server";
import { isServerOnlyField } from "@/lib/ghost/script";
import { refreshVoiceProfile } from "@/lib/server/voice/capture";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { autosaveResumeAllowed } from "@/lib/stages/gate-guard";

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
      /** Client clock (ms) when this position was reached; resume compares it with the device copy. */
      at: z.number().optional(),
    })
    .optional(),
  session: z.unknown().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Who is saving, and do they own this paper. getClaims verifies the session
 * JWT signature locally when the project uses asymmetric signing keys (and
 * falls back to the Auth server otherwise), so a save no longer pays for an
 * extra network round trip. The paper read also returns current_stage so the
 * resume update does not need its own read.
 */
async function owner(paperId: string) {
  if (!z.string().uuid().safeParse(paperId).success) return null;
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = !claimsError && typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return null;
  const { data: paper } = await supabase
    .from("papers")
    .select("id, current_stage, resume")
    .eq("id", paperId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!paper) return null;
  return {
    supabase,
    userId,
    currentStage: (paper.current_stage as number | null) ?? 1,
    resume: paper.resume ?? null,
  };
}

export async function GET(_request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  const auth = await owner(paperId);
  if (!auth) return NextResponse.json({ drafts: [], resume: null, session: null });
  const { data, error } = await auth.supabase
    .from("paper_autosaves")
    .select("field_key, draft_text, submitted, updated_at")
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
  return NextResponse.json({
    drafts: rows
      // Server-only rows (the ghost script) never reach the browser (Colton t221u).
      .filter((row) => row.field_key !== "loop_session" && !isServerOnlyField(row.field_key))
      .map((row) => ({
        fieldKey: row.field_key,
        text: row.draft_text,
        submitted: row.submitted,
        updatedAt: row.updated_at,
      })),
    resume: auth.resume,
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
  // Reserved server-only keys can't be written (or overwritten) from the browser.
  if (isServerOnlyField(body.fieldKey)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const now = new Date().toISOString();
  // The draft row, the session row and the resume pointer are independent
  // writes, so run them together instead of one after another. Any failure
  // still returns 500, so the client keeps the text and does not move on.
  const writes: PromiseLike<{ label: string; error: { code?: string; message: string } | null }>[] = [
    auth.supabase
      .from("paper_autosaves")
      .upsert(
        {
          paper_id: paperId,
          user_id: auth.userId,
          field_key: body.fieldKey,
          draft_text: body.text,
          submitted: Boolean(body.submitted),
          updated_at: now,
        },
        { onConflict: "paper_id,field_key" },
      )
      .then(({ error }) => ({ label: "write", error })),
  ];
  if (body.session !== undefined) {
    writes.push(
      auth.supabase
        .from("paper_autosaves")
        .upsert(
          {
            paper_id: paperId,
            user_id: auth.userId,
            field_key: "loop_session",
            draft_text: JSON.stringify(body.session),
            submitted: true,
            updated_at: now,
          },
          { onConflict: "paper_id,field_key" },
        )
        .then(({ error }) => ({ label: "session", error })),
    );
  }
  if (body.resume) {
    // Autosave never moves the paper's stage (preserved gates); only the progress
    // route can, after the student's explicit confirm. The pointer moves within it.
    const resumeHere = autosaveResumeAllowed(body.resume.stage, auth.currentStage);
    writes.push(
      auth.supabase
        .from("papers")
        .update({
          ...(resumeHere ? { resume: body.resume } : {}),
          updated_at: now,
        })
        .eq("id", paperId)
        .eq("user_id", auth.userId)
        .then(({ error }) => ({ label: "resume", error })),
    );
  }
  const results = await Promise.all(writes);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error(`[autosave] ${failed.label} failed`, { code: failed.error.code, message: failed.error.message });
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  // PC-32 (Colton t219u): a saved Stage 2/3 session carries the student's newest words; the voice
  // profile picks them up quietly (throttled, after the response; never part of the save).
  if (body.session !== undefined) {
    after(() => refreshVoiceProfile(auth.supabase, paperId, auth.userId, { throttleMs: 60_000, reason: "session_save" }));
  }
  return NextResponse.json({ ok: true });
}
