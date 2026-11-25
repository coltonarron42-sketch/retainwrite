import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import {
  SPARK_SYSTEM,
  fallbackSparkQuestions,
  sparkKind,
  sparkUserPrompt,
  validateSparkQuestions,
} from "@/lib/stage1/spark";
import { createClient } from "@/lib/supabase/server";
import { refsUnreadMaterial, scrubUnreadRefs } from "@/lib/stage1/north-turns";

export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().min(1).max(64),
  questionText: z.string().min(1).max(600),
  questionKind: z.string().max(32).optional(),
  topic: z.string().max(500).optional(),
  interests: z.array(z.string().max(200)).max(3).optional(),
  /** QA 11:40 #4: the student hasn't read the material and hasn't had the catch-up. */
  unread: z.boolean().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * One light model call for 2–3 open questions; rule-based fallback otherwise.
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
  const kind = sparkKind(body.questionId, body.questionKind);
  const fallback = fallbackSparkQuestions(kind);

  const demo = await getDemoSession();
  if (demo || !hasSupabaseConfig()) {
    return NextResponse.json({ questions: fallback, source: "rules" });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: paper } = await supabase
    .from("papers")
    .select("id")
    .eq("id", paperId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let questions: string[] | null = null;
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: body.unread
      ? `${SPARK_SYSTEM}\nThe student has NOT read the assigned material yet. Never mention or assume any article, chapter, book, reading, author or a leader "from the reading". Ask only about their own thinking and experience.`
      : SPARK_SYSTEM,
    user: sparkUserPrompt({
      questionText: body.unread ? scrubUnreadRefs(body.questionText) : body.questionText,
      topic: body.topic,
      interests: body.interests,
    }),
    jsonSchema: {
      name: "spark_questions",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { questions: { type: "array", items: { type: "string" } } },
        required: ["questions"],
      },
    },
    timeoutMs: 6_000,
  });
  if (res.ok) {
    try {
      questions = validateSparkQuestions((JSON.parse(res.text) as { questions?: unknown }).questions);
      if (questions && body.unread) {
        const kept = questions.filter((q) => !refsUnreadMaterial(q));
        questions = kept.length ? kept : null;
      }
    } catch {
      questions = null;
    }
  }

  await logSessionEvent({
    paperId,
    stage: 1,
    event: "hesitation_spark_shown",
    detail: { questionId: body.questionId, source: questions ? "model" : "rules" },
  });

  return NextResponse.json({ questions: questions ?? fallback, source: questions ? "model" : "rules" });
}
