import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import {
  parseSearchTerm,
  parseSearchTerms,
  SEARCH_TERM_SCHEMA,
  SEARCH_TERM_SYSTEM,
  SEARCH_TERMS_SCHEMA,
  SEARCH_TERMS_SYSTEM,
} from "@/lib/coaching/searchTerm";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  topic: z.string().min(1).max(4000).transform((v) => v.slice(0, 500)),
  section: z.string().max(200).transform((v) => v.slice(0, 80)).optional(),
  note: z.string().max(8000).transform((v) => v.slice(0, 1200)).optional(),
  // Batch form (QA 3:35 C): every section in one call when Stage 2 loads.
  sections: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        title: z.string().max(200).transform((v) => v.slice(0, 80)),
        needs: z.string().max(2000).transform((v) => v.slice(0, 240)).optional(),
      }),
    )
    .max(12)
    .optional(),
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
  if (body.sections?.length) {
    const keys = body.sections.map((s) => s.key);
    const res = await grokChatJson({
      model: MODEL_FAST,
      reasoningEffort: "low",
      system: SEARCH_TERMS_SYSTEM,
      user: JSON.stringify({ topic: body.topic, sections: body.sections }),
      jsonSchema: { name: "search_queries", schema: SEARCH_TERMS_SCHEMA as unknown as Record<string, unknown> },
      timeoutMs: 20_000,
    });
    let queries: Record<string, string> = {};
    if (res.ok) {
      try {
        queries = parseSearchTerms(JSON.parse(res.text), keys);
      } catch {
        queries = {};
      }
    }
    return NextResponse.json({ queries, source: Object.keys(queries).length ? "model" : "rules", reason: res.ok ? undefined : res.reason });
  }
  if (!body.section) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const res = await grokChatJson({
    model: MODEL_FAST,
    reasoningEffort: "low",
    system: SEARCH_TERM_SYSTEM,
    user: JSON.stringify({ topic: body.topic, section: body.section, student_note: body.note ?? "" }),
    jsonSchema: { name: "search_query", schema: SEARCH_TERM_SCHEMA as unknown as Record<string, unknown> },
    // Low reasoning effort takes a few seconds; the keyword fallback shows meanwhile.
    timeoutMs: 15_000,
  });
  let query: string | null = null;
  if (res.ok) {
    try {
      query = parseSearchTerm(JSON.parse(res.text));
    } catch {
      query = null;
    }
  }
  // `reason` explains a fallback (no secrets): the model failed, or its query was rejected.
  const reason = query ? undefined : res.ok ? "rejected" : res.reason;
  const raw = !query && res.ok ? res.text.slice(0, 120) : undefined;
  return NextResponse.json({ query, source: query ? "model" : "rules", reason, raw });
}
