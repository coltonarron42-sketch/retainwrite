import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assignmentRequirementsSchema } from "@/lib/assignment/schema";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import {
  CONFIRM_REPLY_SCHEMA,
  CONFIRM_REPLY_SYSTEM,
  cardForModel,
  confirmUserPrompt,
  finalizeResult,
  isQuickConfirm,
  parseModelResult,
  rulesClassify,
  type ConfirmResult,
} from "@/lib/stage1/confirm-reply";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const turnSchema = z.union([
  z.object({ role: z.literal("student"), text: z.string().max(2000) }),
  z.object({ role: z.literal("pau"), paras: z.array(z.string().max(2000)).max(12) }),
]);

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  pendingAsk: z.enum(["topic", "sources", "length"]).nullable().optional(),
  requirements: assignmentRequirementsSchema,
  sheetExcerpt: z.string().max(8000).optional(),
  history: z.array(turnSchema).max(30).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Classifies the student's natural reply to the read-back (PLAN.md 9).
 * Plain confirms skip the model; the rules take over if the model fails.
 * // SOP: coaching only, never generate submission text
 */
export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) {
    return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const pendingAsk = body.pendingAsk ?? null;
  const rules = rulesClassify(body.message, pendingAsk);
  if (isQuickConfirm(body.message)) return NextResponse.json({ ...rules, source: "rules" });

  const demo = await getDemoSession();
  if (!demo) {
    if (!hasSupabaseConfig()) return NextResponse.json({ ...rules, source: "rules" });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: paper } = await supabase
      .from("papers")
      .select("id")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let result: ConfirmResult | null = null;
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: CONFIRM_REPLY_SYSTEM,
    user: confirmUserPrompt({
      card: cardForModel(body.requirements),
      sheetExcerpt: body.sheetExcerpt,
      pendingAsk,
      history: body.history ?? [],
      message: body.message,
    }),
    jsonSchema: { name: "confirm_reply", schema: CONFIRM_REPLY_SCHEMA as unknown as Record<string, unknown> },
    timeoutMs: 9_000,
  });
  if (res.ok) {
    try {
      result = parseModelResult(JSON.parse(res.text));
    } catch {
      result = null;
    }
  }
  const out = finalizeResult(result, rules, pendingAsk);
  if (!demo) {
    await logSessionEvent({
      paperId,
      stage: 1,
      event: "confirm_reply",
      detail: { intent: out.intent, source: result ? "model" : "rules" },
    });
  }
  return NextResponse.json({ ...out, source: result ? "model" : "rules" });
}
