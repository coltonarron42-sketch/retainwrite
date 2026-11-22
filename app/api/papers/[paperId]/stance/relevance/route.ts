import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { parseRelevance, RELEVANCE_SCHEMA, RELEVANCE_SYSTEM } from "@/lib/coaching/relevance";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  notes: z.string().min(1).max(4000),
  prompt: z.string().min(1).max(1000),
  section: z.string().max(200).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Stage 2: is this note about the prompt? { onTopic: boolean | null }.
 * null means the model didn't answer; the client uses its rules.
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
  const demo = await getDemoSession();
  if (!demo) {
    if (!hasSupabaseConfig()) return NextResponse.json({ onTopic: null, source: "rules" });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: paper } = await supabase.from("papers").select("id").eq("id", paperId).eq("user_id", user.id).maybeSingle();
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: RELEVANCE_SYSTEM,
    user: JSON.stringify({ prompt: body.prompt, section: body.section ?? "", student_note: body.notes }),
    jsonSchema: { name: "note_relevance", schema: RELEVANCE_SCHEMA as unknown as Record<string, unknown> },
    timeoutMs: 6_000,
  });
  let onTopic: boolean | null = null;
  if (res.ok) {
    try {
      onTopic = parseRelevance(JSON.parse(res.text));
    } catch {
      onTopic = null;
    }
  }
  return NextResponse.json({ onTopic, source: onTopic === null ? "rules" : "model" });
}
