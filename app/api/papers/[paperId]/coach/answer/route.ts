import { after, NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadPaperContextBlock } from "@/lib/server/paper-context/store";
import { ghostGuidance, ghostLeakCheck, type GhostScript } from "@/lib/ghost/script";
import { backfillGhost, readGhost } from "@/lib/server/ghost/store";
import { COACH_ANSWER_SYSTEM, cleanCoachAnswer, type CoachAnswerMode } from "@/lib/coach/answer";

export const runtime = "nodejs";
/** A missing ghost is backfilled in after() (plan + section-by-section writing, usually 1-3 min). */
export const maxDuration = 800;

/**
 * Stages 1-3 typed: Pau ANSWERS content and teaching questions ("what are
 * the leadership styles?", "examples of leaders?", "show me an example outline
 * line"), turns "idk" into key points or named options, and pushes a vague note
 * toward specifics (QA 11/23 BUS 210 audit). Never their sentences.
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.object({
  mode: z.enum(["answer", "lost", "vague", "interview"]),
  message: z.string().min(1).max(2000),
  stage: z.number().int().min(1).max(3),
  section: z.string().max(200).optional(),
  ask: z.string().max(1000).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const started = Date.now();
  let block = "";
  let ghost: GhostScript | null = null;
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Owner check and context load side by side (RLS also scopes the reads).
    // Stages 2-3 also read the hidden ghost script (Colton t221u): guidance only, gated below.
    const [{ data: paper }, loaded, g] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      loadPaperContextBlock(supabase, paperId).catch(() => null),
      body.stage >= 2 ? readGhost(supabase, paperId) : Promise.resolve(null),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    block = loaded?.block ?? "";
    ghost = g;
    // No ghost yet (it failed or timed out at Stage 1): build it in the background (capped).
    if (body.stage >= 2 && !g) after(() => backfillGhost(supabase, paperId, userId));
  }
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: ghost ? `${COACH_ANSWER_SYSTEM}\n\n${ghostGuidance(ghost)}` : COACH_ANSWER_SYSTEM,
    user: JSON.stringify({
      mode: body.mode as CoachAnswerMode,
      stage: body.stage,
      section: body.section ?? "",
      coach_asked: body.ask ?? "",
      student_message: body.message,
      paper_context: block,
    }),
    jsonSchema: {
      name: "coach_answer",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { paras: { type: "array", items: { type: "string" } } },
        required: ["paras"],
      },
    },
    timeoutMs: 7_000,
  });
  let paras: string[] = [];
  if (res.ok) {
    try {
      paras = cleanCoachAnswer((JSON.parse(res.text) as { paras?: unknown }).paras, { mode: body.mode, message: body.message });
    } catch {
      paras = [];
    }
  }
  if (paras.some((p) => !assertCoachingOnly(p).ok)) paras = [];
  // Never the ghost's sentences: any 5-word overlap or near-copy drops the reply (client falls back).
  let ghostBlocked = false;
  if (ghost && paras.length) {
    const allowed = [body.message, body.ask ?? "", block].join("\n");
    if (paras.some((p) => !ghostLeakCheck(p, ghost, allowed).ok)) {
      paras = [];
      ghostBlocked = true;
    }
  }
  console.info("[coach-answer]", { mode: body.mode, stage: body.stage, ms: Date.now() - started, ok: paras.length > 0, ghost: Boolean(ghost), ghostBlocked });
  return NextResponse.json({ paras });
}
