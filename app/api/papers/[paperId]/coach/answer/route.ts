import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { grokResearch, type ResearchSource } from "@/lib/ai/grok-research";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadPauContextBlock } from "@/lib/server/paper-context/store";
import { cleanPauParas, coachAnswerSystem } from "@/lib/coach/answer";
import { classifyTurn, resolveMode } from "@/lib/coach/effort";
import { gateParas, reframeQuestion } from "@/lib/coach/prose-gate";
import { groundParas } from "@/lib/coach/grounding";
import { capOneAsk, countAsks } from "@/lib/coach/one-ask";
import { checkLinks } from "@/lib/voice/realtime/links";
import { signSpoken, spokenFrom } from "@/lib/coach/spoken-sign";
import type { PaperContext } from "@/lib/stage1/paper-context";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Stages 1-3 typed: Pau's free-form turns (PC-31, Colton t207u). Her new
 * system prompt (lib/coach/pau-prompt.ts), the full paper context, xAI's
 * server-side web_search on research turns, reasoning effort per turn
 * (lib/coach/effort.ts), then the code gates: pasteable prose is stripped and
 * reframed (lib/coach/prose-gate.ts) and a reply keeps one ask (lib/coach/one-ask.ts).
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.object({
  mode: z.enum(["answer", "lost", "vague", "interview", "research", "summary", "story", "reframe"]),
  message: z.string().min(1).max(2000),
  stage: z.number().int().min(1).max(3),
  section: z.string().max(200).optional(),
  ask: z.string().max(1000).optional(),
  step: z.string().max(60).optional(),
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
  let paperCtx: PaperContext | null = null;
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [{ data: paper }, loaded] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      loadPauContextBlock(supabase, paperId).catch(() => null),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    block = loaded?.block ?? "";
    paperCtx = loaded?.ctx ?? null;
  }

  const turn = classifyTurn(body.message, { mode: body.mode, step: body.step });
  const mode = resolveMode(body.mode, turn.intent);
  // Research turns search. Summaries work from their uploaded pages, or general background when none are
  // uploaded: on the PC-31 preview a summary that searched took ~40 s and found no usable pages for a textbook chapter.
  const search = mode === "research";
  const effort = mode === "reframe" ? "none" : turn.effort;
  const userJson = JSON.stringify({
    mode,
    stage: body.stage,
    section: body.section ?? "",
    coach_asked: body.ask ?? "",
    student_message: body.message,
    paper_context: block,
  });

  let paras: string[] = [];
  let sources: ResearchSource[] = [];
  let searches = 0;
  let path = "chat";
  if (search || mode === "summary") {
    path = search ? "responses+web_search" : "responses";
    const r = await grokResearch({ system: coachAnswerSystem(mode, { plain: true }), user: userJson, effort, search, timeoutMs: 45_000 });
    if (r.ok) {
      paras = cleanPauParas(r.text);
      searches = r.searches;
      sources = r.sources;
    }
  }
  if (!paras.length) {
    if (path !== "chat") path += "→chat";
    const res = await grokChatJson({
      model: MODEL_FAST,
      system: coachAnswerSystem(mode),
      user: userJson,
      reasoningEffort: effort,
      jsonSchema: {
        name: "coach_answer",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { paras: { type: "array", items: { type: "string" } } },
          required: ["paras"],
        },
      },
      timeoutMs: effort === "high" ? 20_000 : effort === "low" ? 15_000 : 7_000,
    });
    if (res.ok) {
      try {
        paras = cleanPauParas((JSON.parse(res.text) as { paras?: unknown }).paras);
      } catch {
        paras = [];
      }
    }
  }

  // Code gates: pasteable prose → reframe; then one ask per turn.
  const names = [paperCtx?.leader?.pick, ...(body.message.match(/\b[A-Z][a-z]{2,}\b/g) ?? [])].filter((n): n is string => Boolean(n));
  // Grounding (side answers): requirement counts only from the assignment; reading claims labeled when we lack the text.
  let grounded = { fixedCounts: [] as string[], labeled: 0 };
  if (mode !== "research" && mode !== "reframe" && paras.length) {
    const haveText = (paperCtx?.readings ?? []).filter((r) => r.text?.trim()).map((r) => r.title);
    const named = [
      ...(paperCtx?.missing ?? []),
      ...(paperCtx?.whereToGet ?? []).map((w) => w.title),
      ...(paperCtx?.readback?.mustInclude ?? []).filter((x) => /chapter|reading|textbook|article|book|\(/i.test(x)),
      ...block.split("\n").filter((l) => /chapter|reading|textbook|article|\bbook\b/i.test(l)),
      ...(paperCtx?.readings ?? []).filter((r) => !r.text?.trim()).map((r) => r.title),
    ];
    const haveTok = new Set(haveText.flatMap((t) => t.match(/\b[A-Z][a-zA-Z'’-]{3,}\b/g) ?? []));
    const g = groundParas(paras, { source: `${block}\n${body.section ?? ""}`, unreadRefs: named.map((t) => (t.match(/\b[A-Z][a-zA-Z'’-]{3,}\b/g) ?? []).filter((w) => !haveTok.has(w)).join(" ")) });
    paras = g.paras;
    grounded = { fixedCounts: g.fixedCounts, labeled: g.labeled };
  }
  const gate = gateParas(paras, { afterWriteRequest: turn.intent === "write_request", context: `${body.message} ${body.section ?? ""}`, names, seed: started, echo: body.message });
  paras = gate.paras;
  const capped = capOneAsk(paras);
  paras = capped.paras;
  // A write request always ends on the one question that hands it back (preview: a reframe came back as one line).
  if (mode === "reframe" && paras.length && countAsks(paras) === 0) paras = [...paras, reframeQuestion({ context: `${body.message} ${body.section ?? ""}`, seed: started })];
  if (paras.some((p) => !assertCoachingOnly(p).ok)) paras = [];

  // Only links that resolve (the same checker the voice relay uses for show_sources).
  if (sources.length) {
    try {
      sources = (await Promise.race([checkLinks(sources.slice(0, 5)), new Promise<ResearchSource[]>((res) => setTimeout(() => res(sources.slice(0, 4)), 2500))])).slice(0, 4);
    } catch {
      sources = sources.slice(0, 4);
    }
  }

  console.info("[coach-answer]", {
    mode,
    asked: body.mode,
    intent: turn.intent,
    effort,
    path,
    searches,
    sources: sources.length,
    gate: gate.blocked ? gate.reason : "pass",
    grounded: grounded.fixedCounts.length || grounded.labeled ? { counts: grounded.fixedCounts.length, labeled: grounded.labeled } : "ok",
    asksDropped: capped.dropped,
    stage: body.stage,
    ms: Date.now() - started,
    ok: paras.length > 0,
  });
  // Voice on: the relay speaks exactly these words (signed for this paper), so research turns run here with tools and the voice says the result.
  const spokenText = paras.length ? spokenFrom(paras) : "";
  const spoken = spokenText ? { text: spokenText, sig: signSpoken(paperId, spokenText) } : null;
  return NextResponse.json({ paras, sources, mode, effort, gated: gate.blocked, spoken });
}
