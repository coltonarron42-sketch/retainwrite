import { kickShape } from "@/lib/server/skeleton/ghost";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { mergeCorpus, type CorpusSegment } from "@/lib/assignment/corpus";
import { DESCRIBED_MIN_WORDS, parseAssignmentCorpus } from "@/lib/assignment/parse";
import { resolveReaderMode } from "@/lib/auth/reader-mode";
import { clearDemoSession, getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { UNREADABLE_ASSIGNMENT, ensureUserPaper } from "@/lib/papers/account";
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
  /** Typed or spoken in the chat box, no file: a short description is enough. */
  described: z.boolean().optional(),
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

  const demo = await getDemoSession();
  let authenticated = false;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
    if (user) await clearDemoSession();

    if (resolveReaderMode({ authenticated, demoSession: Boolean(demo) }) === "live" && user) {
      const ensured = await ensureUserPaper(supabase, user.id, paperId);
      if (!ensured.ok) {
        return NextResponse.json({ error: ensured.error }, { status: ensured.status });
      }

      const started = Date.now();
      const parsed = await parseAssignmentCorpus(corpus, { mode: "live", minWords: body.described ? DESCRIBED_MIN_WORDS : undefined, described: body.described });
      console.info("[assignment/parse] timing", {
        ms: Date.now() - started,
        model: parsed.parseMeta.model,
        fallback: parsed.parseMeta.fallback,
        reason: parsed.parseMeta.reason ?? null,
      });
      if (parsed.needsConfirmation) {
        console.error("[assignment/parse] live read failed", {
          paperId,
          reason: parsed.parseMeta.reason ?? "unreadable",
        });
      }

      await logSessionEvent({
        paperId,
        stage: 1,
        event: parsed.needsConfirmation ? "assignment_parse_needs_input" : "assignment_parsed",
        detail: {
          fallback: false,
          usableWords: parsed.parseMeta.usableWords,
          model: parsed.parseMeta.model,
          reason: parsed.parseMeta.reason ?? null,
        },
      });

      if (parsed.needsConfirmation) {
        return NextResponse.json({
          parseStatus: "needs_confirmation",
          requirements: parsed.requirements,
          rawText: parsed.rawText,
          parseMeta: parsed.parseMeta,
          needsConfirmation: true,
          message: UNREADABLE_ASSIGNMENT,
          saved: false,
        });
      }

      const { error } = await supabase.from("assignments").upsert(
        {
          paper_id: paperId,
          user_id: user.id,
          raw_text: parsed.rawText,
          requirements: parsed.requirements,
          parse_meta: parsed.parseMeta,
          parse_status: "ready",
        },
        { onConflict: "paper_id" },
      );

      if (error) {
        console.error("[assignment/parse] save failed", { paperId, code: error.code });
        return NextResponse.json({
          parseStatus: "ready",
          requirements: parsed.requirements,
          rawText: parsed.rawText,
          parseMeta: parsed.parseMeta,
          saved: false,
          error: "We read the assignment but couldn't store it. Please try again.",
        });
      }

      // Round 4 #1: the real skeleton starts while they read the checklist, so it's in by confirm.
      const userId = user.id;
      after(() => kickShape(paperId, userId, parsed.rawText, parsed.requirements));
      return NextResponse.json({
        parseStatus: "ready",
        requirements: parsed.requirements,
        rawText: parsed.rawText,
        parseMeta: parsed.parseMeta,
        saved: true,
      });
    }
  }

  if (resolveReaderMode({ authenticated, demoSession: Boolean(demo) }) !== "demo" && hasSupabaseConfig()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const parsed = await parseAssignmentCorpus(corpus, { mode: "demo", minWords: body.described ? DESCRIBED_MIN_WORDS : undefined, described: body.described });
  console.info("[assignment/parse] timing", {
    ms: Date.now() - started,
    model: parsed.parseMeta.model,
    fallback: parsed.parseMeta.fallback,
    reason: parsed.parseMeta.reason ?? null,
  });
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

  return NextResponse.json({
    parseStatus: parsed.needsInput ? "needs_input" : "ready",
    requirements: parsed.requirements,
    rawText: parsed.rawText,
    parseMeta: parsed.parseMeta,
    demo: true,
  });
}
