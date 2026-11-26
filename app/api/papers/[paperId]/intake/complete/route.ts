import { after, NextResponse } from "next/server";
import { ensureGhostScript, ghostInputFor } from "@/lib/server/ghost/store";
import { classifyStartingPoint, IDEAS_CHECK_ID, ideasSaid } from "@/lib/stage1/starting-point";
import { z } from "zod";
import { assertAssignmentConfirmGate } from "@/lib/assignment/confirm";
import { assignmentRequirementsSchema } from "@/lib/assignment/schema";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { buildVoiceCorpus, collectVoicePieces } from "@/lib/style/voice-capture";
import { refreshVoiceProfile } from "@/lib/server/voice/capture";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import { createClient } from "@/lib/supabase/server";
import { intakeCompleteAllowed } from "@/lib/stages/gate-guard";
import { wordCount } from "@/lib/utils";
import { readPaperContext, writePaperContext } from "@/lib/server/paper-context/store";

export const runtime = "nodejs";
/** The ghost script is written in after() (plan + section-by-section writing, usually 1-3 min) once the response has gone. */
export const maxDuration = 800;

const answerSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  kind: z.string(),
  answerText: z.string(),
  /** Legacy flag; every answer now feeds the background voice profile. */
  isVoiceSample: z.boolean().optional(),
});

const bodySchema = z.object({
  requirements: assignmentRequirementsSchema,
  answers: z.array(answerSchema).min(1),
  leads: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Legacy; ignored (PC-32). */
  keepBaseline: z.boolean().optional(),
  useInterestProfile: z.boolean().optional(),
  storyAngle: z
    .object({
      text: z.string().min(1),
      source: z.enum(["ai", "student"]),
    })
    .optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Enforce Stage 1 gate, write style/voice profiles, unlock Stage 2.
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

  const cardGate = assertAssignmentConfirmGate(body.requirements);
  if (!cardGate.ok) {
    return NextResponse.json(
      { error: "Assignment card not confirmed", reasons: cardGate.reasons },
      { status: 400 },
    );
  }
  const requirements = cardGate.requirements;

  // PC-32 (Colton t219u, Nov 25): voice is captured in the background from every answer in every
  // stage. Its size is never a Stage 1 condition; the tally is only a passive log stat.

  const stance = body.answers.find((a) => a.questionId === "stance_early");
  // Older papers (and demo) still run the old Stage 1: early take + story angle are required there.
  // New ("north star") papers run the short Stage 1 (Colton t221u): no early take, story or pick.
  const legacyGate = () => {
    if (!stance || wordCount(stance.answerText) < 25) {
      return NextResponse.json({ error: "Early stance needs at least 25 words" }, { status: 400 });
    }
    if (!body.storyAngle?.text?.trim()) {
      return NextResponse.json({ error: "Pick a story angle before finishing Stage 1" }, { status: 400 });
    }
    return null;
  };

  // Every answer they wrote (not only the old "voice sample" questions); the profile itself is
  // refreshed from everything saved on the paper below.
  const sample = buildVoiceCorpus(
    collectVoicePieces({ intake: body.answers.map((a) => ({ questionId: a.questionId, kind: a.kind, text: a.answerText })) }),
  ).text;
  const metrics = computeStyleMetrics(sample);

  await logSessionEvent({
    paperId,
    stage: 1,
    event: "stage1_complete",
    detail: {
      voiceWords: wordCount(sample),
      background: true,
      leadCount: body.leads?.length ?? 0,
      useInterestProfile: body.useInterestProfile ?? true,
    },
  });

  const stage2Url = `/app/papers/${paperId}/stage/2`;

  const demo = await getDemoSession();
  if (demo || !hasSupabaseConfig()) {
    const blocked = legacyGate();
    if (blocked) return blocked;
    return NextResponse.json({
      ok: true,
      demo: true,
      stage2Url,
      styleMetrics: metrics,
      originalThesis: stance?.answerText ?? "",
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Never re-run a finished Stage 1 or rewind a later paper (past stages are review only).
  const { data: current } = await supabase.from("papers").select("current_stage").eq("id", paperId).eq("user_id", user.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!intakeCompleteAllowed((current.current_stage as number | null) ?? 1)) {
    return NextResponse.json({ ok: true, stage2Url, already: true, currentStage: current.current_stage });
  }

  let pctx = await readPaperContext(supabase, paperId);
  let startingIdeas = "";
  if (pctx.northstar) {
    // PC-32 (Colton t221u): Stage 1 is short and sweet. The only hard gate is the confirmed
    // read-back (plus the confirmed card above). Their idea is optional: "no idea" still advances.
    if (pctx.readback && !pctx.readback.confirmed) {
      return NextResponse.json({ error: "Confirm the summary of the assignment first.", reasons: ["readback"], reask: null }, { status: 400 });
    }
    const said = (id: string) => [...body.answers].reverse().find((a) => a.questionId === id && a.answerText.trim())?.answerText.trim() ?? null;
    const point = classifyStartingPoint({
      // QA 6:50 PM: an idea given after the no-ideas nudge is their idea.
      ideas: ideasSaid(body.answers).ideas ?? said(IDEAS_CHECK_ID) ?? said("decision_pick") ?? said("stance_early"),
      followUp: ideasSaid(body.answers).followUp ?? said("decision_why"),
      lostAtStart: pctx.lostAtStart,
      hasReading: Boolean(pctx.readings?.length),
      materialAnswer: said("material_check"),
    });
    startingIdeas = point.ideas ?? "";
    pctx = await writePaperContext(supabase, paperId, user.id, (p) => ({ ...p, startingPoint: point }));
    // The ghost script: written in the background from Pau's own research, server-only, never
    // shown (lib/ghost/script.ts). It never blocks moving to Stage 2.
    const uid = user.id;
    const ghostCtx = pctx;
    after(async () => {
      try {
        const input = await ghostInputFor(supabase, paperId, ghostCtx, requirements);
        await ensureGhostScript(supabase, paperId, uid, input, "stage1_complete");
      } catch (e) {
        console.warn("[ghost] after error", { name: (e as Error)?.name ?? "error" });
      }
    });
  } else {
    const blocked = legacyGate();
    if (blocked) return blocked;
  }

  const now = new Date().toISOString();

  // Background voice capture: style_profiles + voice_profiles from every answer saved so far.
  await refreshVoiceProfile(supabase, paperId, user.id, {
    reason: "stage1_complete",
    extra: body.answers.map((a) => ({ questionId: a.questionId, kind: a.kind, text: a.answerText })),
  });

  await supabase
    .from("stage_progress")
    .upsert([
      {
        paper_id: paperId,
        user_id: user.id,
        stage: 1,
        status: "complete",
        completed_at: now,
        data: {
          useInterestProfile: body.useInterestProfile ?? true,
          originalThesis: stance?.answerText ?? startingIdeas,
          storyAngle: body.storyAngle ?? null,
          startingPoint: pctx.startingPoint?.kind ?? null,
        },
      },
      {
        paper_id: paperId,
        user_id: user.id,
        stage: 2,
        status: "in_progress",
        data: {
          storyAngle: body.storyAngle ?? null,
          originalThesis: stance?.answerText ?? startingIdeas,
        },
      },
    ]);

  await supabase
    .from("papers")
    .update({ current_stage: 2, updated_at: now })
    .eq("id", paperId)
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    stage2Url,
    styleMetrics: metrics,
    originalThesis: stance?.answerText ?? startingIdeas,
  });
}
