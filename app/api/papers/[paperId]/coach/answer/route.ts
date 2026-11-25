import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { grokResearch, RESEARCH_SEARCH_CALLS, MAX_SEARCH_CALLS, type ResearchSource } from "@/lib/ai/grok-research";
import { getCachedResearch, putCachedResearch, researchCacheKey, searchCacheOn } from "@/lib/ai/research-cache";
import { dropBlocked, unreadReadingNames, withUploadInvite } from "@/lib/coach/reading-sources";
import { CHECKING_LINE, STATUS_ROTATION } from "@/lib/coach/thinking-status";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadPauContextBlock } from "@/lib/server/paper-context/store";
import { cleanPauParas, coachAnswerSystem } from "@/lib/coach/answer";
import { classifyTurn, resolveMode } from "@/lib/coach/effort";
import { gateParas, reframeQuestion } from "@/lib/coach/prose-gate";
import { groundParas, refTokens } from "@/lib/coach/grounding";
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
  /** PC-31 t213u: stream NDJSON status lines ({type:"status"}) then the answer ({type:"done"}). */
  stream: z.boolean().optional(),
  /** Dev/test only: skip the search cache for a real, uncached search (ignored where the cache is off). */
  fresh: z.boolean().optional(),
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

  const streaming = body.stream === true;
  const compute = async (emit: (line: string) => void) => {
    const turn = classifyTurn(body.message, {
      mode: body.mode,
      step: body.step,
    });
    const resolved = resolveMode(body.mode, turn.intent);
    // t213u #4: a question about an assigned reading we don't have the text of → look for the reading itself.
    const unread = unreadReadingNames({
      readings: paperCtx?.readings,
      missing: paperCtx?.missing,
      whereToGet: paperCtx?.whereToGet,
      mustInclude: paperCtx?.readback?.mustInclude,
      block,
    });
    const unreadTok = refTokens(unread.titles);
    const mentionsUnread =
      unreadTok.some((t) => new RegExp(`\\b${t}\\b`, "i").test(body.message)) ||
      (resolved === "summary" && unread.titles.length > 0) ||
      (/\b(?:the|my|our|this|that)\s+(?:chapter|reading|readings|article|textbook)\b/i.test(body.message) && unread.titles.length > 0);
    const mode =
      (resolved === "answer" || resolved === "summary" || resolved === "research" || resolved === "lost") && mentionsUnread && body.mode !== "interview" && body.mode !== "story"
        ? "reading"
        : resolved;
    // Research and reading turns search. Summaries of uploaded pages work from them (no search).
    const search = mode === "research" || mode === "reading";
    const effort = mode === "reframe" ? "none" : mode === "reading" ? "high" : turn.effort;
    emit(STATUS_ROTATION[mode === "reading" ? "reading" : mode === "research" ? "research" : mode === "summary" ? "summary" : "think"][0]!);
    const userJson = JSON.stringify({
      mode,
      stage: body.stage,
      section: body.section ?? "",
      coach_asked: body.ask ?? "",
      student_message: body.message,
      paper_context: block,
      ...(mode === "reading" ? { unread_readings: unread.titles } : {}),
    });

    let paras: string[] = [];
    let sources: ResearchSource[] = [];
    let searches = 0;
    let path = "chat";
    let cache: "off" | "hit" | "miss" | "bypass" = "off";
    if (search || mode === "summary") {
      path = search ? "responses+web_search" : "responses";
      // t213u #1: dev/test search cache (never in production): repeated test turns reuse results.
      const cacheKey =
        search && searchCacheOn()
          ? researchCacheKey({
              message: body.message,
              mode,
              stage: body.stage,
              section: body.section,
              context: block,
            })
          : null;
      const hit = cacheKey && !body.fresh ? await getCachedResearch(cacheKey) : null;
      if (cacheKey) cache = body.fresh ? "bypass" : hit ? "hit" : "miss";
      if (hit) {
        emit("Pulling it together…");
        paras = cleanPauParas(hit.text);
        sources = hit.sources;
      } else {
        const r = await grokResearch({
          system: coachAnswerSystem(mode, { plain: true }),
          user: userJson,
          effort,
          search,
          maxSearches: mode === "reading" ? MAX_SEARCH_CALLS : RESEARCH_SEARCH_CALLS,
          timeoutMs: 45_000,
          onStatus: streaming ? emit : undefined,
        });
        if (r.ok) {
          paras = cleanPauParas(r.text);
          searches = r.searches;
          sources = r.sources;
          if (cacheKey)
            void putCachedResearch(cacheKey, {
              text: r.text,
              sources: r.sources,
              searches: r.searches,
            });
        }
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
      const g = groundParas(paras, {
        source: `${block}\n${body.section ?? ""}`,
        unreadRefs: unread.titles,
      });
      paras = g.paras;
      grounded = { fixedCounts: g.fixedCounts, labeled: g.labeled };
    }
    const gate = gateParas(paras, {
      afterWriteRequest: turn.intent === "write_request",
      context: `${body.message} ${body.section ?? ""}`,
      names,
      seed: started,
      echo: body.message,
    });
    paras = gate.paras;
    const capped = capOneAsk(paras);
    paras = capped.paras;
    // A write request always ends on the one question that hands it back (preview: a reframe came back as one line).
    if (mode === "reframe" && paras.length && countAsks(paras) === 0)
      paras = [
        ...paras,
        reframeQuestion({
          context: `${body.message} ${body.section ?? ""}`,
          seed: started,
        }),
      ];
    if (paras.some((p) => !assertCoachingOnly(p).ok)) paras = [];

    // t213u #4: no pirated copies; a reading reply always invites their own scan or PDF.
    let blocked = 0;
    if (search) {
      const d = dropBlocked(sources, paras);
      sources = d.sources;
      paras = d.paras;
      blocked = d.dropped;
    }
    if (mode === "reading" && paras.length) paras = withUploadInvite(paras);

    // Only links that resolve (the same checker the voice relay uses for show_sources).
    if (sources.length) {
      emit(CHECKING_LINE);
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
      cache,
      blocked,
      sources: sources.length,
      gate: gate.blocked ? gate.reason : "pass",
      grounded: grounded.fixedCounts.length || grounded.labeled ? { counts: grounded.fixedCounts.length, labeled: grounded.labeled } : "ok",
      asksDropped: capped.dropped,
      stage: body.stage,
      ms: Date.now() - started,
      ok: paras.length > 0,
      streamed: streaming,
    });
    // Voice on: the relay speaks exactly these words (signed for this paper), so research turns run here with tools and the voice says the result.
    const spokenText = paras.length ? spokenFrom(paras) : "";
    const spoken = spokenText ? { text: spokenText, sig: signSpoken(paperId, spokenText) } : null;
    return { paras, sources, mode, effort, gated: gate.blocked, spoken };
  };

  if (!streaming) return NextResponse.json(await compute(() => undefined));
  // NDJSON: {"type":"status","text":"Searching for …"} lines while she works, then {"type":"done", ...answer}.
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = "";
      const send = (o: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      const emit = (text: string) => {
        if (!text || text === last) return;
        last = text;
        send({ type: "status", text });
      };
      // Heartbeat: a long think between steps never looks like a dead connection to the browser.
      const beat = setInterval(() => send({ type: "tick" }), 5_000);
      try {
        send({ type: "done", ...(await compute(emit)) });
      } catch {
        send({
          type: "done",
          paras: [],
          sources: [],
          mode: body.mode,
          effort: "none",
          gated: false,
          spoken: null,
        });
      }
      clearInterval(beat);
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
