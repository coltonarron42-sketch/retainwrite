import { NextResponse } from "next/server";
import { z } from "zod";
import { mergeCorpus, type CorpusSegment } from "@/lib/assignment/corpus";
import { parseAssignmentCorpus } from "@/lib/assignment/parse";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const segmentSchema = z.object({
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  page: z.number().int().positive().optional(),
  text: z.string(),
  method: z.string().optional(),
  quality: z.number().optional(),
});

const bodySchema = z.object({
  /** Pre-merged corpus (demo / client extract). */
  corpusText: z.string().max(500_000).optional(),
  segments: z.array(segmentSchema).max(200).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Starts corpus merge + requirements extraction.
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

  const segments: CorpusSegment[] = body.segments ?? [];
  const corpus =
    body.corpusText?.trim() ||
    mergeCorpus(segments);

  if (!corpus.trim()) {
    return NextResponse.json(
      { error: "No usable text yet", parseStatus: "needs_input" },
      { status: 400 },
    );
  }

  const parsed = await parseAssignmentCorpus(corpus);

  await logSessionEvent({
    paperId,
    stage: 1,
    event: parsed.needsInput ? "assignment_parse_needs_input" : "assignment_parsed",
    detail: {
      fallback: parsed.parseMeta.fallback,
      usableWords: parsed.parseMeta.usableWords,
      model: parsed.parseMeta.model,
    },
  });

  const demo = await getDemoSession();
  if (demo || !hasSupabaseConfig()) {
    return NextResponse.json({
      parseStatus: parsed.needsInput ? "needs_input" : "ready",
      requirements: parsed.requirements,
      rawText: parsed.rawText,
      parseMeta: parsed.parseMeta,
      demo: Boolean(demo) || !hasSupabaseConfig(),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: assignment, error } = await supabase
    .from("assignments")
    .upsert(
      {
        paper_id: paperId,
        user_id: user.id,
        raw_text: parsed.rawText,
        requirements: parsed.requirements,
        parse_meta: parsed.parseMeta,
        parse_status: parsed.needsInput ? "needs_input" : "ready",
      },
      { onConflict: "paper_id" },
    )
    .select("id, parse_status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    parseStatus: assignment.parse_status,
    requirements: parsed.requirements,
    rawText: parsed.rawText,
    parseMeta: parsed.parseMeta,
  });
}
