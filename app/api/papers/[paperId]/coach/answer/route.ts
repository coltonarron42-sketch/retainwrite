import { after, NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadPaperContextBlock } from "@/lib/server/paper-context/store";
import { ghostGuidance, ghostLeakCheck, type GhostScript } from "@/lib/ghost/script";
import { backfillGhost, readGhost } from "@/lib/server/ghost/store";
import { COACH_ANSWER_SYSTEM, cleanCoachAnswer, type CoachAnswerMode } from "@/lib/coach/answer";

export const runtime = "nodejs";
/** A missing ghost is backfilled in after() (plan + section-by-section writing, usually 1-3 min). */
export const maxDuration = 800;

/**
 * Stages 1-3 typed: Pau ANSWERS content and teaching questions ("what are
 * the leadership styles?", "examples of leaders?", "show me an example outline
 * line"), turns "idk" into key points or named options, and pushes a vague note
 * toward specifics (QA 11/23 BUS 210 audit). Never their sentences.
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.object({
  mode: z.enum(["answer", "lost", "vague", "interview"]),
  message: z.string().min(1).max(2000),
  stage: z.number().int().min(1).max(3),
  section: z.string().max(200).optional(),
  ask: z.string().max(1000).optional(),
  /** The student's own notes so far (their words are never "ghost" overlap). */
  notes: z.string().max(8000).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const started = Date.now();
  let block = "";
  let ghost: GhostScript | null = null;
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Owner check and context load side by side (RLS also scopes the reads).
    // Stages 2-3 also read the hidden ghost script (Colton t221u): guidance only, gated below.
    const [{ data: paper }, loaded, g] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      loadPaperContextBlock(supabase, paperId).catch(() => null),
      body.stage >= 2 ? readGhost(supabase, paperId) : Promise.resolve(null),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    block = loaded?.block ?? "";
    ghost = g;
    // No ghost yet (it failed or timed out at Stage 1): build it in the background (capped).
    if (body.stage >= 2 && !g) after(() => backfillGhost(supabase, paperId, userId));
  }
  const system = ghost ? `${COACH_ANSWER_SYSTEM}\n\n${ghostGuidance(ghost)}` : COACH_ANSWER_SYSTEM;
  const user = JSON.stringify({
    mode: body.mode as CoachAnswerMode,
    stage: body.stage,
    section: body.section ?? "",
    coach_asked: body.ask ?? "",
    student_message: body.message,
    paper_context: block,
  });
  const ask = async (extra = "") => {
    const res = await grokChatJson({
      model: MODEL_FAST,
      system: extra ? `${system}\n\n${extra}` : system,
      user,
      jsonSchema: {
        name: "coach_answer",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { paras: { type: "array", items: { type: "string" } } },
          required: ["paras"],
        },
      },
      timeoutMs: 7_000,
    });
    let out: string[] = [];
    if (res.ok) {
      try {
        out = cleanCoachAnswer((JSON.parse(res.text) as { paras?: unknown }).paras, { mode: body.mode, message: body.message });
      } catch {
        out = [];
      }
    }
    return out.some((p) => !assertCoachingOnly(p).ok) ? [] : out;
  };
  // Never the ghost's sentences (PC-32 QA 5:15 PM gate: distinctive runs only). The student's
  // words, the assignment, the brief and the readings in the context block are allowed overlap.
  const allowed = [body.message, body.ask ?? "", body.section ?? "", body.notes ?? "", block].join("\n");
  const gate = (ps: string[]) => {
    let hits5 = 0;
    let hits8 = 0;
    let rule: string | null = null;
    for (const p of ps) {
      const r = ghostLeakCheck(p, ghost, allowed);
      hits5 += r.hits5;
      hits8 += r.hits8;
      if (!r.ok) rule ??= r.rule ?? "blocked";
    }
    return { ok: rule === null, rule, hits5, hits8 };
  };
  let paras = await ask();
  let ghostBlocked = false;
  let regen: { ok: boolean; rule: string | null; hits5: number; hits8: number } | null = null;
  const first = ghost && paras.length ? gate(paras) : { ok: true, rule: null, hits5: 0, hits8: 0 };
  if (!first.ok) {
    ghostBlocked = true;
    // One retry in different words; the client's fallback only if that is blocked too.
    const again = await ask(
      "Your previous draft read too much like a finished paper. Answer the student's question again in completely different, plain conversational words: short coaching, no paper-like prose, no thesis-style sentences, nothing that could be pasted into an essay.",
    );
    regen = again.length ? gate(again) : { ok: false, rule: "empty", hits5: 0, hits8: 0 };
    paras = regen.ok ? again : [];
  }
  console.info("[coach-answer]", {
    mode: body.mode,
    stage: body.stage,
    ms: Date.now() - started,
    ok: paras.length > 0,
    ghost: Boolean(ghost),
    ghostBlocked,
    gate: { rule: first.rule, hits5: first.hits5, hits8: first.hits8 },
    regen: regen ? { ok: regen.ok, rule: regen.rule, hits5: regen.hits5, hits8: regen.hits8 } : null,
  });
  return NextResponse.json({ paras });
}
