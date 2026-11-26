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
import {
  COACH_ANSWER_STRUCTURED,
  COACH_ANSWER_SYSTEM,
  FACTS_RETRY_INSTRUCTION,
  THESIS_FOR_THEM,
  cleanCoachAnswer,
  noFactsReply,
  pruneGhostParas,
  BACKGROUND_LABEL,
  oneQuestion,
  readingCatalog,
  shapeStructuredAnswer,
  type CoachAnswerMode,
  type ReadingRef,
} from "@/lib/coach/answer";
import { isWriteRequest, writeRequestReply } from "@/lib/stages/stance-intent";
import { fitPairFromContext } from "@/lib/stage2/fit-check";
import { leaderAcross } from "@/lib/stage1/lock-in";

export const runtime = "nodejs";
/** A missing ghost is backfilled in after() (plan + section-by-section writing, usually 1-3 min). */
/**
 * The one retry after a gate block (QA 5:15 PM; QA 5:33 PM: the retry must still answer the question
 * with real specifics, just not in paper sentences).
 */
const RETRY_INSTRUCTION =
  "Your previous draft read too much like a finished paper. Answer the student's question again, still directly and specifically: if they asked about a leader, give concrete facts about what that leader actually did (actions, decisions, habits), from paper_context or clearly labelled as general background, never invented. Use your own plain, conversational words. Don't phrase anything as a thesis, a claim about which style is best, or a sentence from a paper; no argument for their essay. End with one question about their choice.";

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
  let leader: string | null = null;
  let readings: ReadingRef[] = [];
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
    leader = loaded?.ctx ? (fitPairFromContext(loaded.ctx as never)?.leader ?? null) : null;
    readings = readingCatalog((loaded?.ctx ?? null) as never);
    ghost = g;
    // No ghost yet (it failed or timed out at Stage 1): build it in the background (capped).
    if (body.stage >= 2 && !g) after(() => backfillGhost(supabase, paperId, userId));
  }
  // QA 5:51 PM: "Just give me the intro paragraph" (any section): the same warm decline as the
  // thesis request, no recap, one question; no model call.
  if (isWriteRequest(body.message)) {
    console.info("[coach-answer]", { mode: body.mode, stage: body.stage, ms: Date.now() - started, ok: true, writeRequest: true });
    return NextResponse.json({ paras: writeRequestReply(body.section ?? "", body.message) });
  }
  const structured = body.mode === "answer";
  // QA 6:15 PM: content answers come back structured (readings, background facts, one question).
  const base = structured ? `${COACH_ANSWER_SYSTEM}\n\n${COACH_ANSWER_STRUCTURED}` : COACH_ANSWER_SYSTEM;
  const system = ghost ? `${base}\n\n${ghostGuidance(ghost)}` : base;
  const askedLeader = leader ?? leaderAcross([body.message], "");
  const user = JSON.stringify({
    mode: body.mode as CoachAnswerMode,
    stage: body.stage,
    section: body.section ?? "",
    coach_asked: body.ask ?? "",
    student_message: body.message,
    ...(structured ? { student_leader: askedLeader ?? "", readings: readings.map((r) => ({ id: r.id, title: r.title, author: r.author, key_points: r.points })) } : {}),
    paper_context: block,
  });
  const schema = structured
    ? {
        type: "object",
        additionalProperties: false,
        properties: {
          explain: { type: "string" },
          readingPoints: {
            type: "array",
            items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, readingId: { type: "string" } }, required: ["text", "readingId"] },
          },
          leaderFacts: { type: "array", items: { type: "string" } },
          question: { type: "string" },
        },
        required: ["explain", "readingPoints", "leaderFacts", "question"],
      }
    : { type: "object", additionalProperties: false, properties: { paras: { type: "array", items: { type: "string" } } }, required: ["paras"] };
  let lastShape: { leaderFacts: number; aboutLeader: boolean } | null = null;
  const ask = async (extra = "") => {
    const res = await grokChatJson({
      model: MODEL_FAST,
      system: extra ? `${system}\n\n${extra}` : system,
      user,
      jsonSchema: { name: "coach_answer", schema },
      timeoutMs: 7_000,
    });
    let out: string[] = [];
    if (res.ok) {
      try {
        const j = JSON.parse(res.text) as Record<string, unknown>;
        if (structured) {
          const shaped = shapeStructuredAnswer({ raw: j, readings, leader: askedLeader, message: body.message });
          lastShape = shaped;
          out = shaped.paras.map((p) => cleanCoachAnswer([p], { mode: body.mode, message: body.message })[0] ?? "").filter(Boolean);
        } else {
          out = oneQuestion(cleanCoachAnswer(j.paras, { mode: body.mode, message: body.message }));
          // Never their thesis stated for them ("Your paper will argue…").
          out = out.map((p) => p.split(/(?<=[.!?])\s+/).filter((x) => !THESIS_FOR_THEM.test(x)).join(" ")).filter(Boolean);
        }
      } catch {
        out = [];
      }
    }
    return out.some((p) => !assertCoachingOnly(p).ok) ? [] : out;
  };
  // Never the ghost's sentences (PC-32 QA 5:15 PM gate: distinctive runs only). The student's
  // words, the assignment, the brief and the readings in the context block are allowed overlap.
  const allowed = [body.message, body.ask ?? "", body.section ?? "", body.notes ?? "", block].join("\n");
  // The student's own terms (their leader, their style, the words of their question) are never
  // "ghost wording" on their own (QA 5:33 PM: "How did Sam Walton show servant leadership?").
  const topic = [body.message, body.notes ?? ""].join("\n");
  const gate = (ps: string[]) => {
    let hits5 = 0;
    let hits8 = 0;
    let hitsFact = 0;
    let rule: string | null = null;
    for (const p of ps) {
      const r = ghostLeakCheck(p, ghost, allowed, topic);
      hits5 += r.hits5;
      hits8 += r.hits8;
      hitsFact += r.hitsFact ?? 0;
      if (!r.ok) rule ??= r.rule ?? "blocked";
    }
    return { ok: rule === null, rule, hits5, hits8, hitsFact };
  };
  let paras = await ask();
  let ghostBlocked = false;
  let regen: ReturnType<typeof gate> | null = null;
  const first = ghost && paras.length ? gate(paras) : { ok: true, rule: null, hits5: 0, hits8: 0, hitsFact: 0 };
  const passes = (t: string) => ghostLeakCheck(t, ghost, allowed, topic).ok;
  // A structured answer keeps its clean parts when one part reads like the ghost (QA 6:15 walk).
  const salvage = (ps: string[]) => {
    if (!structured || !ghost) return null;
    const pr = pruneGhostParas(ps, passes);
    return pr.length && gate(pr).ok ? pr : null;
  };
  let blocked = !first.ok;
  let pruned = false;
  if (blocked) {
    ghostBlocked = true;
    const pr = salvage(paras);
    if (pr) {
      paras = pr;
      pruned = true;
      blocked = false;
    }
  }
  const shape1 = lastShape as { leaderFacts: number; aboutLeader: boolean } | null;
  const hasFacts = (ps: string[]) => ps.some((p) => p.startsWith(BACKGROUND_LABEL));
  // QA 6:15 PM: a question about their leader with no leader facts gets one retry asking for 2-3.
  const noFacts = Boolean(structured && shape1?.aboutLeader && (shape1.leaderFacts === 0 || !hasFacts(paras)));
  let factsRetry: { leaderFacts: number } | null = null;
  if (blocked || noFacts) {
    // One retry (different words after a gate block; concrete facts when none came back).
    let again = await ask([blocked ? RETRY_INSTRUCTION : "", noFacts ? FACTS_RETRY_INSTRUCTION : ""].filter(Boolean).join("\n\n"));
    const shape2 = lastShape as { leaderFacts: number; aboutLeader: boolean } | null;
    regen = !ghost ? { ok: again.length > 0, rule: again.length ? null : "empty", hits5: 0, hits8: 0, hitsFact: 0 } : again.length ? gate(again) : { ok: false, rule: "empty", hits5: 0, hits8: 0, hitsFact: 0 };
    if (!regen.ok && again.length) {
      const pr = salvage(again);
      if (pr) {
        again = pr;
        regen = { ...regen, ok: true, rule: `${regen.rule}:pruned` };
      }
    }
    const retryFacts = (shape2?.leaderFacts ?? 0) > 0 && hasFacts(again);
    if (noFacts) factsRetry = { leaderFacts: retryFacts ? (shape2?.leaderFacts ?? 0) : 0 };
    if (regen.ok && (!noFacts || retryFacts)) paras = again;
    else if (noFacts && askedLeader && (regen.ok || !blocked)) paras = noFactsReply(askedLeader);
    else if (blocked) paras = [];
  }
  console.info("[coach-answer]", {
    mode: body.mode,
    stage: body.stage,
    ms: Date.now() - started,
    ok: paras.length > 0,
    ghost: Boolean(ghost),
    ghostBlocked,
    gate: { rule: first.rule, hits5: first.hits5, hits8: first.hits8, hitsFact: first.hitsFact },
    structured,
    pruned,
    factsRetry,
    regen: regen ? { ok: regen.ok, rule: regen.rule, hits5: regen.hits5, hits8: regen.hits8, hitsFact: regen.hitsFact } : null,
  });
  return NextResponse.json({ paras });
}
