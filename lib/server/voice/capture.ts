import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStyleMetrics } from "@/lib/style/metrics";
import {
  buildVoiceCorpus,
  collectVoicePieces,
  type IntakeVoiceRow,
  type LoopVoiceSession,
  type VoicePiece,
} from "@/lib/style/voice-capture";

/**
 * Background voice capture (Colton t219u, Nov 25, 2026; PC-32). Reads the
 * student's own words saved so far on this paper (Stage 1 answers, Stage 2/3
 * session) and refreshes the existing style_profiles (per paper) and
 * voice_profiles (per user) rows. Never a gate, never thrown: a failure only
 * logs, and the next save tries again. No new tables or columns.
 */
export async function loadVoicePieces(supabase: SupabaseClient, paperId: string, extra: IntakeVoiceRow[] = []): Promise<VoicePiece[]> {
  const [intake, session] = await Promise.all([
    supabase
      .from("intake_answers")
      .select("question_id, question_kind, answer_text, decision, paste_ratio, answered_at, created_at")
      .eq("paper_id", paperId)
      .order("created_at", { ascending: true }),
    supabase
      .from("paper_autosaves")
      .select("draft_text")
      .eq("paper_id", paperId)
      .eq("field_key", "loop_session")
      .maybeSingle(),
  ]);
  const rows: IntakeVoiceRow[] = (intake.data ?? []).map((r) => ({
    questionId: String(r.question_id ?? ""),
    kind: (r.question_kind as string | null) ?? null,
    text: r.answer_text as string | null,
    skipped: r.decision === "skipped",
    pasteRatio: r.paste_ratio == null ? null : Number(r.paste_ratio),
  }));
  let loop: LoopVoiceSession = null;
  try {
    loop = session.data?.draft_text ? (JSON.parse(session.data.draft_text) as LoopVoiceSession) : null;
  } catch {
    loop = null;
  }
  // Answers the client just sent (Stage 1 complete) land after the saved ones, so the latest wins.
  return collectVoicePieces({ intake: [...rows, ...extra], session: loop });
}

export type VoiceRefresh = { ok: boolean; skipped?: "throttled" | "empty"; words?: number; stages?: number[] };

/**
 * Refresh the profiles from everything saved so far. `throttleMs` skips the
 * write when this user's voice profile was refreshed that recently (busy
 * autosaves); stage moves and Stage 1 complete pass 0.
 */
export async function refreshVoiceProfile(
  supabase: SupabaseClient,
  paperId: string,
  userId: string,
  opts: { throttleMs?: number; reason?: string; extra?: IntakeVoiceRow[] } = {},
): Promise<VoiceRefresh> {
  try {
    if (opts.throttleMs && opts.throttleMs > 0) {
      const { data } = await supabase.from("voice_profiles").select("updated_at").eq("user_id", userId).maybeSingle();
      const at = data?.updated_at ? Date.parse(String(data.updated_at)) : 0;
      if (at && Date.now() - at < opts.throttleMs) return { ok: true, skipped: "throttled" };
    }
    const corpus = buildVoiceCorpus(await loadVoicePieces(supabase, paperId, opts.extra));
    if (!corpus.words) return { ok: true, skipped: "empty" };
    const metrics = computeStyleMetrics(corpus.text);
    const now = new Date().toISOString();
    const [style, voice] = await Promise.all([
      supabase.from("style_profiles").upsert({
        paper_id: paperId,
        user_id: userId,
        raw_sample: corpus.text,
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
        source: "background_answers",
      }),
      supabase.from("voice_profiles").upsert({
        user_id: userId,
        sample_text: corpus.text,
        metrics,
        word_count: metrics.wordCount,
        natural_words: corpus.naturalWords,
        typed_word_share: corpus.typedWordShare,
        source: "merged",
        updated_at: now,
      }),
    ]);
    const error = style.error ?? voice.error;
    if (error) {
      console.warn("[voice-capture] write failed", { code: error.code, reason: opts.reason ?? null });
      return { ok: false };
    }
    return { ok: true, words: corpus.words, stages: corpus.stages };
  } catch (e) {
    console.warn("[voice-capture] refresh error", { message: String((e as Error)?.message ?? e).slice(0, 120), reason: opts.reason ?? null });
    return { ok: false };
  }
}
