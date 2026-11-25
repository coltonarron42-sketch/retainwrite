import { NextResponse } from "next/server";
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
import { pickFrom } from "@/lib/stage1/paper-context";
import { northstarGateFrom } from "@/lib/stage1/intake-resume";

export const runtime = "nodejs";

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
  if (!stance || wordCount(stance.answerText) < 25) {
    return NextResponse.json(
      { error: "Early stance needs at least 25 words" },
      { status: 400 },
    );
  }

  if (!body.storyAngle?.text?.trim()) {
    return NextResponse.json(
      { error: "Pick a story angle before finishing Stage 1" },
      { status: 400 },
    );
  }

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
    return NextResponse.json({
      ok: true,
      demo: true,
      stage2Url,
      styleMetrics: metrics,
      originalThesis: stance.answerText,
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

  // North star (QA 7:02 AM): skipping everything never passes. A confirmed read-back, the
  // material, a decision with its reason (and leader when needed) are still required, on
  // top of the early-take and story-angle hard gates above.
  let pctx = await readPaperContext(supabase, paperId);
  // Server-side recovery (QA 10:21 walk C): a pick that's in their answers but never reached
  // the paper context (a dropped request) is restored from the answers, not lost.
  if (pctx.northstar && !pctx.decision?.answer) {
    const pick = [...body.answers].reverse().find((a) => a.questionId === "decision_pick" && a.answerText.trim());
    if (pick) {
      const why = [...body.answers].reverse().find((a) => a.questionId === "decision_why" && a.answerText.trim())?.answerText.trim();
      const answer = [pick.answerText.trim().replace(/[.!?\s]+$/, ""), why].filter(Boolean).join(". ").slice(0, 2000);
      pctx = await writePaperContext(supabase, paperId, user.id, (p) => ({
        ...p,
        decision: p.decision ?? { question: "Your pick", pick: pickFrom(answer, p.options?.options ?? []), answer, at: Date.now(), source: "asked" },
      }));
    }
  }
  if (pctx.northstar) {
    const gate = northstarGateFrom({
      answers: body.answers.map((a) => ({ questionId: a.questionId, answerText: a.answerText })),
      decisionAnswer: pctx.decision?.answer ?? null,
      needsLeader: (pctx.options?.people?.length ?? 0) >= 2,
      leaderAnswer: pctx.leader?.answer ?? null,
      materialShown: Boolean(pctx.materialShownAt),
    });
    const reasons = [
      ...(pctx.readback && !pctx.readback.confirmed ? ["readback"] : []),
      ...(gate.catchUpDone ? [] : ["material"]),
      ...(gate.decided ? [] : ["decision"]),
    ];
    if (reasons.length) {
      // Tell the client which question to re-ask, so the student is never left at a dead gate.
      const reask = !gate.decided
        ? !(pctx.decision?.answer || body.answers.some((a) => a.questionId === "decision_pick" && a.answerText.trim()))
          ? "decision_pick"
          : (pctx.options?.people?.length ?? 0) >= 2 && !pctx.leader?.answer && !body.answers.some((a) => a.questionId === "leader_pick" && a.answerText.trim())
            ? "leader_pick"
            : "decision_why"
        : null;
      return NextResponse.json({ error: "Finish the Stage 1 steps first: the read-back, the material, and your decision with a reason.", reasons, reask }, { status: 400 });
    }
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
          originalThesis: stance.answerText,
          storyAngle: body.storyAngle,
        },
      },
      {
        paper_id: paperId,
        user_id: user.id,
        stage: 2,
        status: "in_progress",
        data: {
          storyAngle: body.storyAngle,
          originalThesis: stance.answerText,
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
    originalThesis: stance.answerText,
  });
}
