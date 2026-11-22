import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { parseSearchTerm, SEARCH_TERM_SCHEMA, SEARCH_TERM_SYSTEM } from "@/lib/coaching/searchTerm";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  topic: z.string().min(1).max(4000).transform((v) => v.slice(0, 500)),
  section: z.string().max(200).transform((v) => v.slice(0, 80)),
  note: z.string().max(8000).transform((v) => v.slice(0, 1200)).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Stage 2 leads: one natural 2-6 word library query for a section.
 * { query: string | null }; null means the client keeps its keyword fallback.
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
    if (!hasSupabaseConfig()) return NextResponse.json({ query: null, source: "rules" });
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
    reasoningEffort: "low",
    system: SEARCH_TERM_SYSTEM,
    user: JSON.stringify({ topic: body.topic, section: body.section, student_note: body.note ?? "" }),
    jsonSchema: { name: "search_query", schema: SEARCH_TERM_SCHEMA as unknown as Record<string, unknown> },
    timeoutMs: 6_000,
  });
  let query: string | null = null;
  if (res.ok) {
    try {
      query = parseSearchTerm(JSON.parse(res.text));
    } catch {
      query = null;
    }
  }
  return NextResponse.json({ query, source: query ? "model" : "rules" });
}
