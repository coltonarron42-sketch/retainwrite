import { NextResponse } from "next/server";
import { tallyVoiceWords } from "@/lib/stage1/voice";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KINDS = new Set([
  "interest",
  "coaching",
  "personal",
  "fallback_voice",
  "background",
  "story_angle",
]);

type Ctx = { params: Promise<{ paperId: string }> };

/** Saved Stage 1 answers for this paper. Used to restore a refresh. */
export async function GET(_request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) {
    return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  }
  if (!hasSupabaseConfig()) return NextResponse.json({ answers: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ answers: [] });

  const [{ data, error }, assignment] = await Promise.all([
    supabase
      .from("intake_answers")
      .select("question_id, question_text, question_kind, answer_text, is_voice_sample, paste_ratio")
      .eq("paper_id", paperId)
      .eq("user_id", user.id)
      .order("sequence", { ascending: true }),
    supabase
      .from("assignments")
      .select("story_angle")
      .eq("paper_id", paperId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (error) {
    console.error("[intake/answers] load failed", { code: error.code, message: error.message });
    return NextResponse.json({ answers: [] });
  }

  const answers = (data ?? [])
    .filter((row) => KINDS.has(row.question_kind) && row.answer_text.trim())
    .map((row) => ({
      questionId: row.question_id,
      questionText: row.question_text,
      kind: row.question_kind,
      answerText: row.answer_text,
      isVoiceSample: row.is_voice_sample,
      pasteRatio: row.paste_ratio ?? undefined,
    }));

  const { data: paper } = await supabase
    .from("papers")
    .select("resume")
    .eq("id", paperId)
    .eq("user_id", user.id)
    .maybeSingle();
  const story = assignment.data?.story_angle as { text?: string; source?: string } | null;
  const storyAngle =
    story && typeof story.text === "string" && story.text.trim()
      ? { text: story.text.trim(), source: story.source === "student" ? "student" : "ai" }
      : null;

  return NextResponse.json({
    answers,
    storyAngle,
    resume: paper?.resume ?? null,
    voiceWords: tallyVoiceWords(
      answers.map((answer) => ({
        questionId: answer.questionId,
        text: answer.answerText,
        isVoiceSample: answer.isVoiceSample,
      })),
    ),
  });
}
