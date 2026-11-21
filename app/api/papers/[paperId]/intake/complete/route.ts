import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAssignmentConfirmGate } from "@/lib/assignment/confirm";
import { assignmentRequirementsSchema } from "@/lib/assignment/schema";
import {
  evaluateStage1VoiceMinimum,
  type VoiceAnswer,
} from "@/lib/stage1/voice";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import { createClient } from "@/lib/supabase/server";
import { wordCount } from "@/lib/utils";

export const runtime = "nodejs";

const answerSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  kind: z.string(),
  answerText: z.string(),
  isVoiceSample: z.boolean(),
});

const bodySchema = z.object({
  requirements: assignmentRequirementsSchema,
  answers: z.array(answerSchema).min(1),
  leads: z.array(z.record(z.string(), z.unknown())).optional(),
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

  const voiceAnswers: VoiceAnswer[] = body.answers.map((a) => ({
    text: a.answerText,
    isVoiceSample: a.isVoiceSample,
    kind: a.kind,
  }));
  const voice = evaluateStage1VoiceMinimum({
    answers: voiceAnswers,
    keepBaseline: body.keepBaseline,
  });
  // A short voice sample is a warning, not a hard stop (PLAN.md). It is
  // logged below so coaching can lean on fewer voice cues.

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

  const sample = body.answers
    .filter((a) => a.isVoiceSample)
    .map((a) => a.answerText)
    .join("\n");
  const metrics = computeStyleMetrics(sample);

  await logSessionEvent({
    paperId,
    stage: 1,
    event: "stage1_complete",
    detail: {
      voiceWords: voice.totalWords,
      voiceShort: !voice.ok,
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

  const now = new Date().toISOString();

  await supabase.from("style_profiles").upsert({
    paper_id: paperId,
    user_id: user.id,
    raw_sample: sample,
    word_count: metrics.wordCount,
    avg_sentence_length: metrics.avgSentenceLength,
    reading_grade: metrics.readingGrade,
    formality: metrics.formality,
    formality_score: metrics.formalityScore,
    top_content_words: metrics.topContentWords,
    vocabulary: metrics.vocabulary,
    sentence_length_variance: metrics.sentenceLengthVariance,
    scholarly_register_score: metrics.scholarlyRegisterScore,
    tone_markers: metrics.toneMarkers,
    source: "stage1_answers",
  });

  await supabase.from("voice_profiles").upsert({
    user_id: user.id,
    sample_text: sample,
    metrics: metrics,
    word_count: metrics.wordCount,
    source: "stage1",
    updated_at: now,
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
