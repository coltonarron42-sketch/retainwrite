import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import {
  finalStanceIntent,
  needsModel,
  parseStanceIntent,
  rulesStanceIntent,
  STANCE_INTENT_SCHEMA,
  STANCE_INTENT_SYSTEM,
  type StanceIntent,
} from "@/lib/stages/stance-intent";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  ask: z.string().max(1000).optional(),
  section: z.string().max(200).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Stage 2/3: is the student's message content, or a request/question to the
 * coach? Requests are never saved as notes. Rules are the fallback.
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
  const rules = rulesStanceIntent(body.message);
  if (!needsModel(body.message)) return NextResponse.json({ intent: rules, source: "rules" });

  const demo = await getDemoSession();
  if (!demo) {
    if (!hasSupabaseConfig()) return NextResponse.json({ intent: rules, source: "rules" });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: paper } = await supabase.from("papers").select("id").eq("id", paperId).eq("user_id", user.id).maybeSingle();
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let model: StanceIntent | null = null;
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: STANCE_INTENT_SYSTEM,
    user: JSON.stringify({ coach_asked: body.ask ?? "", section: body.section ?? "", student_message: body.message }),
    jsonSchema: { name: "stance_intent", schema: STANCE_INTENT_SCHEMA as unknown as Record<string, unknown> },
    timeoutMs: 6_000,
  });
  if (res.ok) {
    try {
      model = parseStanceIntent(JSON.parse(res.text));
    } catch {
      model = null;
    }
  }
  return NextResponse.json({ intent: finalStanceIntent(model, rules), source: model ? "model" : "rules" });
}
