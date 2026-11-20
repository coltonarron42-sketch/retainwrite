import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import { wordCount } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  answer: z.string().max(20_000).optional(),
  skipInterest: z.boolean().optional(),
  skipThisQuestion: z.boolean().optional(),
  voiceChoice: z.enum(["keep", "refresh"]).optional(),
  useInterestProfile: z.boolean().optional(),
  questionId: z.string().optional(),
  questionText: z.string().optional(),
  questionKind: z
    .enum([
      "interest",
      "coaching",
      "background",
      "personal",
      "fallback_voice",
      "lead_followup",
    ])
    .optional(),
  sequence: z.number().int().nonnegative().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Persist the previous answer and return the next coaching step.
 * Full MODEL_FAST adaptive path plugs in here; demo returns ack only
 * so the client scripted plan can advance.
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

  const wc = body.answer ? wordCount(body.answer) : 0;

  await logSessionEvent({
    paperId,
    stage: 1,
    event: body.skipInterest
      ? "interest_skipped"
      : body.skipThisQuestion
        ? "question_skipped"
        : "intake_answer",
    detail: {
      questionId: body.questionId ?? null,
      kind: body.questionKind ?? null,
      wordCount: wc,
    },
  });

  const demo = await getDemoSession();
  if (demo || !hasSupabaseConfig()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      saved: Boolean(body.answer || body.skipThisQuestion || body.skipInterest),
      wordCount: wc,
      // Client keeps the scripted plan until MODEL_FAST is wired end-to-end.
      done: false,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.answer != null && body.questionId && body.questionText && body.questionKind) {
    const isVoice =
      body.questionKind === "interest" ||
      body.questionKind === "coaching" ||
      body.questionKind === "personal" ||
      body.questionKind === "fallback_voice";

    await supabase.from("intake_answers").insert({
      paper_id: paperId,
      user_id: user.id,
      sequence: body.sequence ?? 0,
      question_id: body.questionId,
      question_text: body.questionText,
      question_kind: body.questionKind,
      answer_text: body.answer,
      word_count: wc,
      is_voice_sample: isVoice,
      answered_at: new Date().toISOString(),
      decision: body.skipThisQuestion ? "skipped" : "move_on",
    });
  }

  return NextResponse.json({
    ok: true,
    saved: true,
    wordCount: wc,
    done: false,
  });
}
