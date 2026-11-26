import { after, NextResponse } from "next/server";
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
import {
  BACKGROUND_LABEL,
  COACH_ANSWER_STRUCTURED,
  FACTS_RETRY_INSTRUCTION,
  THESIS_FOR_THEM,
  cleanCoachAnswer,
  cleanPauParas,
  coachAnswerSystem,
  joinSpacedDomains,
  noFactsReply,
  pruneGhostParas,
  readingCatalog,
  shapeStructuredAnswer,
  type ReadingRef,
} from "@/lib/coach/answer";
import { ghostGuidance, ghostLeakCheck, type GhostScript } from "@/lib/ghost/script";
import { backfillGhost, readGhost } from "@/lib/server/ghost/store";
import { isWriteRequest, writeRequestReply } from "@/lib/stages/stance-intent";
import { fitPairFromContext } from "@/lib/stage2/fit-check";
import { leaderAcross } from "@/lib/stage1/lock-in";
import { classifyTurn, resolveMode } from "@/lib/coach/effort";
import { gateParas, reframeQuestion } from "@/lib/coach/prose-gate";
import { groundParas, refTokens } from "@/lib/coach/grounding";
import { capOneAsk, countAsks } from "@/lib/coach/one-ask";
import { checkLinks } from "@/lib/voice/realtime/links";
import { signSpoken, spokenFrom } from "@/lib/coach/spoken-sign";
import type { PaperContext } from "@/lib/stage1/paper-context";
import { askedStyle, knownExamplesFor, researchCloser } from "@/lib/coach/known-examples";

export const runtime = "nodejs";
/** #79: a missing ghost is backfilled in after() (plan + section-by-section writing, usually 1-3 min). */
export const maxDuration = 800;
/**
 * #79: the one retry after a ghost-gate block (QA 5:15 PM; QA 5:33 PM: the retry must still answer the question
 * with real specifics, just not in paper sentences).
 */
const RETRY_INSTRUCTION =
  "Your previous draft read too much like a finished paper. Answer the student's question again, still directly and specifically: if they asked about a leader, give concrete facts about what that leader actually did (actions, decisions, habits), from paper_context or clearly labelled as general background, never invented. Use your own plain, conversational words. Don't phrase anything as a thesis, topic sentence or paper line.";

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
  /** #79: the student's own notes so far (their words are never "ghost" overlap). */
  notes: z.string().max(8000).optional(),
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
  // QA 6:35 #3: research turns aim for ~20s; optional passes (rescue, background model) only run inside it.
  const TURN_BUDGET_MS = 19_000;
  let block = "";
  let paperCtx: PaperContext | null = null;
  let leader: string | null = null;
  let style: string | null = null;
  let readings: ReadingRef[] = [];
  let ghost: GhostScript | null = null;
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // #79: Stages 2-3 also read the hidden ghost script (Colton t221u): guidance only, gated below.
    const [{ data: paper }, loaded, g] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      loadPauContextBlock(supabase, paperId).catch(() => null),
      body.stage >= 2 ? readGhost(supabase, paperId).catch(() => null) : Promise.resolve(null),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    block = loaded?.block ?? "";
    paperCtx = loaded?.ctx ?? null;
    const pair = loaded?.ctx ? fitPairFromContext(loaded.ctx as never) : null;
    leader = pair?.leader ?? null;
    style = pair?.style ?? null;
    readings = readingCatalog((loaded?.ctx ?? null) as never);
    ghost = g;
    // No ghost yet (it failed or timed out at Stage 1): build it in the background (capped).
    if (body.stage >= 2 && !g) after(() => backfillGhost(supabase, paperId, userId));
  }

  const streaming = body.stream === true;
  const compute = async (emit: (line: string) => void) => {
    const turn = classifyTurn(body.message, {
      mode: body.mode,
      step: body.step,
    });
    const resolved = resolveMode(body.mode, turn.intent);
    // #79 (QA 5:51 PM): "Just give me the intro paragraph" (any section) gets the same warm decline as the
    // thesis request, no recap, one question; no model call.
    if (isWriteRequest(body.message)) {
      const paras = writeRequestReply(body.section ?? "", body.message);
      console.info("[coach-answer]", { mode: "reframe", asked: body.mode, stage: body.stage, ms: Date.now() - started, ok: true, writeRequest: true });
      const spokenText = spokenFrom(paras);
      return { paras, sources: [] as ResearchSource[], mode: "reframe" as const, effort: "none" as const, gated: false, spoken: spokenText ? { text: spokenText, sig: signSpoken(paperId, spokenText) } : null };
    }
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
    // #79 ghost gate: the student's words, the assignment, the brief and the readings are allowed overlap,
    // and their own terms (their leader, their style, their question's words) are never "ghost wording".
    const askedLeader = leader ?? leaderAcross([body.message], "");
    const allowed = [body.message, body.ask ?? "", body.section ?? "", body.notes ?? "", block].join("\n");
    const topic = [body.message, body.notes ?? ""].join("\n");
    const ghostGate = (ps: string[]) => {
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
    const passesGhost = (t: string) => ghostLeakCheck(t, ghost, allowed, topic).ok;
    const salvage = (ps: string[]) => {
      if (!ghost) return null;
      const pr = pruneGhostParas(ps, passesGhost);
      return pr.length && ghostGate(pr).ok ? pr : null;
    };
    const ghostInfo: {
      on: boolean;
      blocked: boolean;
      rule: string | null;
      pruned: boolean;
      first: { rule: string | null; hits5: number; hits8: number; hitsFact: number } | null;
      regen: { ok: boolean; rule: string | null } | null;
      factsRetry: { leaderFacts: number } | null;
    } = { on: Boolean(ghost), blocked: false, rule: null, pruned: false, first: null, regen: null, factsRetry: null };
    let lastShape: { leaderFacts: number; aboutLeader: boolean } | null = null;
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
        // QA 6:35 #2/#3: mainstream styles come from the vetted table (no second model call); the model is
        // asked only for a style that isn't there, with whatever time is left in the ~20s budget.
        const style = askedStyle(body.message, [paperCtx?.decision?.pick, paperCtx?.decision?.answer]);
        const knownExamples = async (): Promise<string[]> => {
          const table = knownExamplesFor(style);
          if (table.length) return table;
          const left = TURN_BUDGET_MS - (Date.now() - started);
          if (left < 3_000) return [];
          const bgr = await grokResearch({
            system: `You help a student find examples for a paper (coaching only; never write their paper). No sources this turn. Give at most 2 bullets (each starting with "• "), each a widely documented real-world example of the leadership style they asked about (if the specific leader or setting they named is obscure, use well-known examples of that style instead; skip any style they set aside with "not" or "no"): the leader's full name, the organization, and in one sentence what they did. Use only examples covered widely in major business press or textbooks; if you aren't sure of one, leave it out (zero is fine). No numbers, dates, quotes or statistics. No site names or sources. Nothing else.`,
            user: JSON.stringify({ ask: body.message.slice(0, 500), style }),
            effort: "low",
            search: false,
            timeoutMs: Math.min(6_000, left),
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
          // QA 6:35 #3: the rescue only runs when there's time left for it in the ~20s budget.
          const left = TURN_BUDGET_MS - (Date.now() - started);
          if (left < 6_000) {
            console.info("[coach-answer] grounded skipped (time)", left);
            return null;
          }
          emit(WRITING_LINE);
          const r3 = await grokResearch({
            system: `${coachAnswerSystem(mode, { plain: true })}\nWeb search is done for this turn. Write 1-3 example bullets using ONLY facts stated in the excerpts in "pages". Each bullet comes from one page: name the real leader (a person, by full name) and organization exactly as that excerpt does, say in one sentence what they did and how it fits the style asked about, and end with that page's site in square brackets, like [hbr.org]. Skip a page that has no named real-world example. Never add a fact, name, number or date that isn't in the excerpt. If no excerpt has a named example, write no bullets. Then one short question about their paper.`,
            user: JSON.stringify({ ...JSON.parse(userJson), pages }),
            effort: "low",
            search: false,
            timeoutMs: Math.min(9_000, left - 1_000),
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
        // QA 6:35 walk: a capped or failed search with nothing to check never falls through to the plain chat
        // (it wrote "[hbr.org]"-tagged bullets from memory). Nothing checked = the labeled-background path.
        if (!q && qmode === "research" && search) {
          if (!bgPromise) bgPromise = knownExamples();
          q = applySourceQuality("", { mode: qmode, sources: [], read: [], fetched: new Map(), titles: r.titles });
        }
        // QA 6:35 #4: every research turn ends its status lines on the writing step.
        if (qmode === "research") emit(WRITING_LINE);
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
          if (qmode === "research") paras = researchCloser(paras, paperCtx?.leader?.pick);
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
      // #79 (QA 6:15 PM): content answers ("answer") come back structured (readings, background facts, one question).
      const structured = mode === "answer";
      const baseSys = structured ? `${coachAnswerSystem("answer")}\n\n${COACH_ANSWER_STRUCTURED}` : coachAnswerSystem(mode);
      const chatSys = ghost ? `${baseSys}\n\n${ghostGuidance(ghost)}` : baseSys;
      const chatUser = structured
        ? JSON.stringify({ ...JSON.parse(userJson), student_leader: askedLeader ?? "", student_style: style ?? "", readings: readings.map((r) => ({ id: r.id, title: r.title, author: r.author, key_points: r.points })) })
        : userJson;
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
      const chatOnce = async (eff: typeof effort, timeoutMs: number, extra = "") => {
        const res = await grokChatJson({
          model: MODEL_FAST,
          system: extra ? `${chatSys}\n\n${extra}` : chatSys,
          user: chatUser,
          reasoningEffort: eff,
          jsonSchema: { name: "coach_answer", schema },
          timeoutMs,
        });
        if (!res.ok) return [];
        try {
          const j = JSON.parse(res.text) as Record<string, unknown>;
          if (structured) {
            const shaped = shapeStructuredAnswer({ raw: j, readings, leader: askedLeader, message: body.message });
            lastShape = shaped;
            return shaped.paras.map((p) => cleanCoachAnswer([p], { mode: "answer", message: body.message })[0] ?? "").filter(Boolean);
          }
          // Never their thesis stated for them ("Your paper will argue…").
          return cleanPauParas(j.paras)
            .map((p) => p.split(/(?<=[.!?])\s+/).filter((x) => !THESIS_FOR_THEM.test(x)).join(" "))
            .filter(Boolean);
        } catch {
          return [];
        }
      };
      // Probing turns (low): ~8-10 s usually, but some ran past 15 s on the preview. Give low 11 s, then
      // one quick pass at none (7 s) instead of the canned fallback.
      const chatMs = effort === "high" ? 20_000 : effort === "low" ? 11_000 : 7_000;
      paras = await chatOnce(effort, chatMs);
      if (!paras.length && effort === "low") {
        path += "→none";
        paras = await chatOnce("none", 7_000);
      }
      // #79: never the ghost's sentences (distinctive runs only); a structured answer keeps its clean parts;
      // one retry after a block, or when a question about their leader came back with no leader facts.
      const first = ghost && paras.length ? ghostGate(paras) : { ok: true, rule: null as string | null, hits5: 0, hits8: 0, hitsFact: 0 };
      ghostInfo.first = { rule: first.rule, hits5: first.hits5, hits8: first.hits8, hitsFact: first.hitsFact };
      let blockedG = !first.ok;
      if (blockedG) {
        ghostInfo.blocked = true;
        ghostInfo.rule = first.rule;
        const pr = structured ? salvage(paras) : null;
        if (pr) {
          paras = pr;
          ghostInfo.pruned = true;
          blockedG = false;
        }
      }
      const shape1 = lastShape as { leaderFacts: number; aboutLeader: boolean } | null;
      const hasFacts = (ps: string[]) => ps.some((p) => p.startsWith(BACKGROUND_LABEL));
      const noFacts = Boolean(structured && shape1?.aboutLeader && (shape1.leaderFacts === 0 || !hasFacts(paras)));
      if (blockedG || noFacts) {
        path += "→retry";
        let again = await chatOnce(effort === "high" ? "low" : effort, chatMs, [blockedG ? RETRY_INSTRUCTION : "", noFacts ? FACTS_RETRY_INSTRUCTION : ""].filter(Boolean).join("\n\n"));
        const shape2 = lastShape as { leaderFacts: number; aboutLeader: boolean } | null;
        const g2 = again.length && ghost ? ghostGate(again) : null;
        let regenOk = again.length > 0 && (!g2 || g2.ok);
        let regenRule: string | null = again.length ? (g2?.rule ?? null) : "empty";
        if (!regenOk && again.length && structured) {
          const pr = salvage(again);
          if (pr) {
            again = pr;
            regenOk = true;
            regenRule = `${regenRule}:pruned`;
          }
        }
        ghostInfo.regen = { ok: regenOk, rule: regenRule };
        const retryFacts = (shape2?.leaderFacts ?? 0) > 0 && hasFacts(again);
        if (noFacts) ghostInfo.factsRetry = { leaderFacts: retryFacts ? (shape2?.leaderFacts ?? 0) : 0 };
        if (regenOk && (!noFacts || retryFacts)) paras = again;
        else if (noFacts && askedLeader && (regenOk || !blockedG)) paras = noFactsReply(askedLeader);
        else if (blockedG) paras = [];
      }
    }

    // #79: research and summary replies never carry the ghost's sentences either (failing paragraphs drop).
    if (ghost && path !== "chat" && !path.includes("→chat") && paras.length && !ghostGate(paras).ok) {
      ghostInfo.blocked = true;
      paras = paras.filter(passesGhost);
      ghostInfo.pruned = true;
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
      // #79's log keys (ghost gate) next to the prose gate.
      gate: { prose: gate.blocked ? gate.reason : "pass", rule: ghostInfo.first?.rule ?? null, hits5: ghostInfo.first?.hits5 ?? 0, hits8: ghostInfo.first?.hits8 ?? 0, hitsFact: ghostInfo.first?.hitsFact ?? 0 },
      ghostBlocked: ghostInfo.blocked,
      pruned: ghostInfo.pruned,
      regen: ghostInfo.regen,
      factsRetry: ghostInfo.factsRetry,
      grounded: grounded.fixedCounts.length || grounded.labeled ? { counts: grounded.fixedCounts.length, labeled: grounded.labeled } : "ok",
      asksDropped: capped.dropped,
      stage: body.stage,
      ms: Date.now() - started,
      ok: paras.length > 0,
      streamed: streaming,
      ghost: ghostInfo.on,
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
