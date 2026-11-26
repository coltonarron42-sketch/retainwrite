import { NextResponse } from "next/server";
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
      .order("sequence", { ascending: true })
      .order("created_at", { ascending: true }),
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

  // An edited answer is a new row for the same question: keep only the latest
  // (in the question's place), so a reload shows what the student last sent.
  const latest = new Map<string, NonNullable<typeof data>[number]>();
  for (const row of data ?? []) {
    if (!KINDS.has(row.question_kind)) continue;
    // An empty newer row clears the question (QA 6:50 PM: later ideas turns after an edit).
    if (!row.answer_text.trim()) {
      latest.delete(row.question_id);
      continue;
    }
    latest.set(row.question_id, row);
  }
  const answers = [...latest.values()]
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
  });
}
