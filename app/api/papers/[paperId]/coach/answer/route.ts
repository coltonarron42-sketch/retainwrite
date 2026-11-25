import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadPaperContextBlock } from "@/lib/server/paper-context/store";
import { COACH_ANSWER_SYSTEM, cleanCoachAnswer, type CoachAnswerMode } from "@/lib/coach/answer";

export const runtime = "nodejs";

/**
 * Stages 1-3 typed: Pau Pau ANSWERS content and teaching questions ("what are
 * the leadership styles?", "examples of leaders?", "show me an example outline
 * line"), turns "idk" into key points or named options, and pushes a vague note
 * toward specifics (QA 11/23 BUS 210 audit). Never their sentences.
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.object({
  mode: z.enum(["answer", "lost", "vague"]),
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
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Owner check and context load side by side (RLS also scopes the reads).
    const [{ data: paper }, loaded] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      loadPaperContextBlock(supabase, paperId).catch(() => null),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    block = loaded?.block ?? "";
  }
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: COACH_ANSWER_SYSTEM,
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
  console.info("[coach-answer]", { mode: body.mode, stage: body.stage, ms: Date.now() - started, ok: paras.length > 0 });
  return NextResponse.json({ paras });
}
