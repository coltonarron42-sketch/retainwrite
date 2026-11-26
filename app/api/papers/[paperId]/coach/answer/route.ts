import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { grokResearch, RESEARCH_SEARCH_CALLS, READING_SEARCH_CALLS, type ResearchSource } from "@/lib/ai/grok-research";
import { sourceHost } from "@/lib/coach/sources-line";
import { applySourceQuality, bestExcerpt, lineUrls, noGoodSourcesParas, offTopicPages, topicTerms, sourceTier, type QualityResult } from "@/lib/coach/source-quality";
import { fetchEvidence } from "@/lib/coach/page-evidence";
import { addPaperSearches, paperSearchesUsed, turnSearchCap } from "@/lib/ai/search-budget";
import { getCachedResearch, putCachedResearch, researchCacheKey, searchCacheOn } from "@/lib/ai/research-cache";
import { dropBlocked, unreadReadingNames, withUploadInvite } from "@/lib/coach/reading-sources";
import { askTopic, CHECKING_LINE, STATUS_ROTATION, WRITING_LINE } from "@/lib/coach/thinking-status";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadPauContextBlock } from "@/lib/server/paper-context/store";
import { cleanPauParas, coachAnswerSystem, joinSpacedDomains } from "@/lib/coach/answer";
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
    // t218u: per-turn cap (2 research / 3 reading) plus a per-paper soft budget.
    const wantsSearch = mode === "research" || mode === "reading";
    const paperUsed = wantsSearch ? await paperSearchesUsed(paperId).catch(() => 0) : 0;
    const searchCap = wantsSearch ? turnSearchCap(paperUsed, mode === "reading" ? READING_SEARCH_CALLS : RESEARCH_SEARCH_CALLS) : 0;
    const search = wantsSearch && searchCap > 0;
    // QA 3:46/4:08 speed: research and reading synthesis run at low (source filter, support check and grounding are in code).
    const effort = mode === "reframe" ? "none" : mode === "reading" || mode === "research" ? "low" : turn.effort;
    emit(STATUS_ROTATION[mode === "reading" ? "reading" : mode === "research" ? "research" : mode === "summary" ? "summary" : "think"][0]!);
    const userJson = JSON.stringify({
      mode,
      stage: body.stage,
      section: body.section ?? "",
      coach_asked: body.ask ?? "",
      student_message: body.message,
      paper_context: block,
      ...(mode === "reading" ? { unread_readings: unread.titles } : {}),
      ...(wantsSearch && !search ? { web_search: "unavailable this turn: answer from general background and label it so" } : {}),
    });

    let paras: string[] = [];
    let sources: ResearchSource[] = [];
    let searches = 0;
    let path = "chat";
    let cache: "off" | "hit" | "miss" | "bypass" = "off";
    let quality:
      | { kept: number; dropped: string[]; retried: boolean; grounded?: boolean; none: boolean; capped: boolean; checks: string[] }
      | undefined;
    if (wantsSearch || mode === "summary") {
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
          maxSearches: searchCap,
          timeoutMs: 45_000,
          // QA 5:32: on a research turn her first draft isn't the answer (the grounded pass writes it), so its
          // "Pulling it together…" waits until the checking step is done: searching → reading → writing.
          onStatus: streaming ? (line: string) => (mode !== "reading" && line === WRITING_LINE ? undefined : emit(line)) : undefined,
          topic: askTopic(body.message),
        });
        searches = r.searches ?? 0;
        const qmode = mode === "reading" ? "reading" : "research";
        const topicWords = (askTopic(body.message) ?? body.message).toLowerCase().split(/\W+/).filter((w) => w.length >= 5);
        // QA 4:08: fetch the cited pages so every bullet's attribution is checked against what the page says.
        const verify = async (rr: { raw: string; sources: ResearchSource[]; read: string[]; titles: Map<string, string> }) => {
          const cands = [...new Set([...lineUrls(rr.raw), ...rr.sources.map((x) => x.url), ...rr.read])].filter((u) => sourceTier(u) >= 2);
          emit(CHECKING_LINE);
          const fetched = await fetchEvidence(cands, { timeoutMs: 3_500, max: 8 });
          const offTopic = qmode === "research" ? offTopicPages(fetched, topicTerms(askTopic(body.message) ?? body.message)) : undefined;
          return { q: applySourceQuality(rr.raw, { mode: qmode, sources: rr.sources, read: rr.read, fetched, titles: rr.titles, offTopic }), fetched };
        };
        let q: QualityResult | null = null;
        const retried = false;
        let groundedUsed = false;
        let capped = false;
        // QA 5:32: grounded extraction. After the (max 2) searches, the example bullets are written ONLY from the
        // fetched text of passing pages, each tied to its page; the lead-name-on-page check stays as the final guard.
        const offTopicOf = (f: Map<string, { url: string; title: string; text: string }>) => (qmode === "research" ? offTopicPages(f, topicTerms(askTopic(body.message) ?? body.message)) : undefined);
        // QA 6:20: the background fallback: at most 2 widely documented examples (a named leader and what they
        // did), no sites, no figures; none when the model isn't sure (R2: never invent).
        let bgPromise: Promise<string[]> | null = null;
        const knownExamples = async (): Promise<string[]> => {
          const bgr = await grokResearch({
            system: `You help a student find examples for a paper (coaching only; never write their paper). No sources this turn. Give at most 2 bullets (each starting with "• "), each a widely documented real-world example of the leadership style they asked about: the leader's full name, the organization, and in one sentence what they did. Use only examples covered widely in major business press or textbooks; if you aren't sure of one, leave it out (zero is fine). No numbers, dates, quotes or statistics. No site names or sources. Nothing else.`,
            user: JSON.stringify({ ask: body.message.slice(0, 500) }),
            effort: "low",
            search: false,
            timeoutMs: 9_000,
          });
          return bgr.ok ? bgr.raw.split(/\n+/) : [];
        };
        const EXAMPLE_WORDS = [...topicWords, "ceo", "led", "leader", "company", "employees", "team", "president", "founder"];
        const grounded = async (
          read: string[],
          titles: Map<string, string> | undefined,
          pre?: Map<string, { url: string; title: string; text: string }>,
        ): Promise<QualityResult | null> => {
          const fetched = pre ?? (await fetchEvidence([...new Set(read)].filter((u) => sourceTier(u) >= 2).slice(0, 6), { timeoutMs: 3_500, max: 6 }));
          const offTopic = offTopicOf(fetched);
          const pages = [...fetched.values()]
            .filter((f) => f.text.length > 200 && sourceTier(f.url) >= 2 && !offTopic?.has(f.url))
            .map((f) => ({ url: f.url, site: sourceHost(f.url), title: f.title, excerpt: bestExcerpt(f.text, EXAMPLE_WORDS, 1800) }))
            .sort((x, y) => sourceTier(y.url) - sourceTier(x.url))
            .slice(0, 4);
          console.info("[coach-answer] grounded pages", JSON.stringify({ fetched: fetched.size, usable: pages.map((x) => `${x.site} (${x.excerpt.length})`) }));
          if (!pages.length) return null;
          emit(WRITING_LINE);
          const r3 = await grokResearch({
            system: `${coachAnswerSystem(mode, { plain: true })}\nWeb search is done for this turn. Write 1-3 example bullets using ONLY facts stated in the excerpts in "pages". Each bullet comes from one page: name the real leader (a person, by full name) and organization exactly as that excerpt does, say in one sentence what they did and how it fits the style asked about, and end with that page's site in square brackets, like [hbr.org]. Skip a page that has no named real-world example. Never add a fact, name, number or date that isn't in the excerpt. If no excerpt has a named example, write no bullets. Then one short question about their paper.`,
            user: JSON.stringify({ ...JSON.parse(userJson), pages }),
            effort: "low",
            search: false,
            timeoutMs: 10_000,
          });
          if (!r3.ok) return null;
          console.info("[coach-answer] grounded draft", JSON.stringify(r3.raw.slice(0, 600)));
          return applySourceQuality(r3.raw, { mode: qmode, sources: pages.map((x) => ({ url: x.url, title: x.title || x.site })), read: pages.map((x) => x.url), fetched, titles, offTopic });
        };
        if (!r.ok && r.reason === "capped" && search) {
          capped = true;
          q = await grounded(r.read ?? [], r.titles);
        } else if (r.ok && search) {
          if (qmode === "research") {
            const cands = [...new Set([...lineUrls(r.raw), ...r.sources.map((x) => x.url), ...r.read])].filter((u) => sourceTier(u) >= 2);
            emit(CHECKING_LINE);
            const fetched = await fetchEvidence(cands, { timeoutMs: 3_000, max: 10 });
            // Her own tagged draft, checked (the fallback), and the grounded rewrite from the pages (preferred).
            const tagged = applySourceQuality(r.raw, { mode: qmode, sources: r.sources, read: r.read, fetched, titles: r.titles, offTopic: offTopicOf(fetched) });
            // Live (9552ba3): with page text read properly (JSON-LD), her checked draft usually keeps 1-3 bullets, and a
            // second model pass costs ~8s+ (over the ~20s budget). So the grounded pass runs when the check left nothing.
            // When the check kept nothing: the grounded pass and the labeled background run side by side (one wait).
            if (tagged.kept === 0) bgPromise = knownExamples();
            const fromPages = tagged.kept === 0 ? await grounded(r.read, r.titles, fetched) : null;
            q = fromPages && fromPages.kept > 0 ? fromPages : tagged;
            groundedUsed = q === fromPages;
          } else {
            q = (await verify(r)).q;
          }
          // QA 5:13: no second search pass. When nothing passes, she goes straight to labeled general background.
        }
        if (q) {
          const none = qmode === "research" && q.kept === 0;
          quality = {
            kept: q.kept,
            dropped: [...new Set(q.dropped.map((d) => `${d.why ?? "weak"}:${d.hosts.join("+")}`))].slice(0, 8),
            retried,
            grounded: groundedUsed,
            none,
            capped,
            checks: q.checks.map((c) => `${c.supported ? (c.retagged ? "RETAGGED" : "OK") : "DROPPED"} | ${c.bullet.slice(0, 90)} | tag ${c.tag} | ${c.page} | "${c.pageTitle.slice(0, 90)}"`),
          };
          if (none) {
            const lastQ = (r.ok ? r.text : "").split(/\n+/).map((l) => l.trim()).filter((l) => /\?\s*$/.test(l)).at(-1) ?? null;
            const background = await (bgPromise ?? knownExamples());
            paras = noGoodSourcesParas(q.dropped, lastQ, background);
            sources = [];
          } else {
            paras = cleanPauParas(q.text);
            sources = q.sources;
          }
        } else if (r.ok) {
          paras = cleanPauParas(r.text);
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
      const chatOnce = async (eff: typeof effort, timeoutMs: number) => {
        const res = await grokChatJson({
          model: MODEL_FAST,
          system: coachAnswerSystem(mode),
          user: userJson,
          reasoningEffort: eff,
          jsonSchema: {
            name: "coach_answer",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: { paras: { type: "array", items: { type: "string" } } },
              required: ["paras"],
            },
          },
          timeoutMs,
        });
        if (!res.ok) return [];
        try {
          return cleanPauParas((JSON.parse(res.text) as { paras?: unknown }).paras);
        } catch {
          return [];
        }
      };
      // Probing turns (low): ~8-10 s usually, but some ran past 15 s on the preview. Give low 11 s, then
      // one quick pass at none (7 s) instead of the canned fallback.
      paras = await chatOnce(effort, effort === "high" ? 20_000 : effort === "low" ? 11_000 : 7_000);
      if (!paras.length && effort === "low") {
        path += "→none";
        paras = await chatOnce("none", 7_000);
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
    paras = paras.map(joinSpacedDomains);

    // Only links that resolve (the same checker the voice relay uses for show_sources).
    if (sources.length) {
      if (!quality) emit(CHECKING_LINE);
      try {
        sources = (await Promise.race([checkLinks(sources.slice(0, 5)), new Promise<ResearchSource[]>((res) => setTimeout(() => res(sources.slice(0, 4)), 2500))])).slice(0, 4);
      } catch {
        sources = sources.slice(0, 4);
      }
    }

    const paperSearches = wantsSearch ? await addPaperSearches(paperId, paperUsed, searches).catch(() => paperUsed + searches) : null;
    if (quality?.checks.length) console.info("[coach-answer] attribution", JSON.stringify({ paper: paperId.slice(0, 8), mode, checks: quality.checks }));
    console.info("[coach-answer]", {
      mode,
      asked: body.mode,
      intent: turn.intent,
      effort,
      path,
      searches,
      searchCap: wantsSearch ? searchCap : undefined,
      quality,
      cited: sources.map((s) => sourceHost(s.url)),
      paperSearches: paperSearches ?? undefined,
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
    return { paras, sources, mode, effort, gated: gate.blocked, spoken, ...(paperSearches !== null ? { searches, paperSearches, cited: sources.map((s) => sourceHost(s.url)) } : {}) };
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
