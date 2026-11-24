import { after, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { logSessionEvent } from "@/lib/session-events";
import { readPaperContext, writePaperContext } from "@/lib/server/paper-context/store";
import { bookLevelTitle, chapterOf, workSummaries, authorOf, investigateWork, findNamedWork, findVideo, materialMore, generalBackground, generateOptions, generateReadback, shortWork, summarizeText, type AssignmentBasics } from "@/lib/server/paper-context/brief";
import { namedWorksFrom, sameWork } from "@/lib/stage1/readings";
import { wellKnownWork } from "@/lib/stage1/well-known";
import { fetchPageText } from "@/lib/server/paper-context/fetch-page";
import { materialPolicy, missingReadingAsk, smartReadingAsk } from "@/lib/config/material-policy";
import { currentSummaries, verifiedSummaries, bestSummary, pickFrom, READING_MAX_CHARS, type MaterialSummary, type PaperContext } from "@/lib/stage1/paper-context";

export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * North-star Stage 1 (Colton t161u): the plain-words read-back, the material
 * summary (their reading > the assignment sheet > labeled general background),
 * the decision options, and the student's decision (verbatim). All stored in the
 * paper context that Stages 2-3 and the voice relay load.
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("readback") }),
  z.object({ action: z.literal("confirm_readback") }),
  z.object({ action: z.literal("summary") }),
  z.object({ action: z.literal("lost") }),
  z.object({ action: z.literal("reading"), title: z.string().max(200).optional(), text: z.string().min(1).max(200_000) }),
  z.object({ action: z.literal("reading_link"), url: z.string().url().max(2000) }),
  z.object({ action: z.literal("options") }),
  z.object({ action: z.literal("material_more"), mode: z.enum(["depth", "simpler", "video"]) }),
  z.object({
    action: z.literal("decision"),
    question: z.string().max(2000),
    answer: z.string().min(1).max(20_000),
    slot: z.enum(["main", "leader"]).optional(),
    source: z.enum(["asked", "stated"]).optional(),
    /** The leader they named themselves ("using Satya Nadella"), when it isn't one of the options. */
    named: z.string().max(80).optional(),
  }),
  z.object({ action: z.literal("material_shown") }),
  z.object({ action: z.literal("context") }),
]);

type Ctx = { params: Promise<{ paperId: string }> };

async function basics(supabase: SupabaseClient, paperId: string): Promise<AssignmentBasics> {
  const [{ data: asg }, { data: paper }] = await Promise.all([
    supabase.from("assignments").select("requirements, raw_text").eq("paper_id", paperId).maybeSingle(),
    supabase.from("papers").select("assignment_prompt").eq("id", paperId).maybeSingle(),
  ]);
  const req = (asg?.requirements ?? {}) as Record<string, { value?: unknown } | undefined>;
  const str = (k: string) => (typeof req[k]?.value === "string" ? (req[k]!.value as string) : null);
  const arr = (k: string) => (Array.isArray(req[k]?.value) ? (req[k]!.value as unknown[]) : []);
  const rubric = arr("rubricCriteria").map((c) => String((c as { name?: string })?.name ?? "")).filter(Boolean);
  const src = req.requiredSources?.value as { countMin?: number; types?: string; notes?: string } | undefined;
  const len = req.length?.value as { raw?: string; wordsMin?: number; wordsMax?: number } | undefined;
  return {
    topic: str("topic"),
    prompt: str("promptQuestion"),
    paperType: str("paperType"),
    rubric,
    structure: arr("structuralRequirements").map(String),
    // QA 6:03 AM: every required reading or handout (sheet notes, provided readings, titles in the text).
    namedWorks: namedWorksFrom(req as Parameters<typeof namedWorksFrom>[0], `${(asg?.raw_text as string | null) ?? ""} ${(paper?.assignment_prompt as string | null) ?? ""}`),
    sources: src ? [src.countMin ? `at least ${src.countMin}` : null, src.types, src.notes].filter(Boolean).join(", ") || null : null,
    length: len?.raw ?? (len?.wordsMin ? `${len.wordsMin}-${len.wordsMax ?? ""} words` : null),
    text: (asg?.raw_text as string | null) || (paper?.assignment_prompt as string | null) || "",
  };
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

type Made = { summary: MaterialSummary | null; more?: MaterialSummary[]; missing?: string[]; whereToGet?: PaperContext["whereToGet"] };

async function makeSummary(supabase: SupabaseClient, paperId: string, ctx: PaperContext): Promise<Made> {
  const a = await basics(supabase, paperId);
  const ask = ctx.readback?.ask ?? null;
  const policy = materialPolicy();
  // QA 6:03 AM: EVERY reading gets the material step. What they gave us is summarized
  // from the text; each other named work is investigated (knowledge, found, or an honest ask).
  const given = (ctx.readings ?? []).slice(-3);
  const fromGiven = (
    await Promise.all(given.map((r) => summarizeText({ kind: "reading", title: r.title, text: r.text, ask, source: r.url ? { title: r.title, url: r.url } : undefined })))
  ).filter((x): x is MaterialSummary => Boolean(x));
  const covered = (w: string) => given.some((r) => sameWork(r.title, w) || (authorOf(w) && r.text.toLowerCase().includes(authorOf(w).toLowerCase())));
  const works = a.namedWorks.filter((w) => !covered(w)).slice(0, 4);
  if (policy === "smart" && works.length) {
    const inv = await Promise.all(works.map((w) => investigateWork(w, ask)));
    const sums = [...fromGiven, ...inv.flatMap(workSummaries)];
    const need = inv.filter((i) => !i.found);
    return {
      summary: sums[0] ?? null,
      more: sums.slice(1),
      missing: need.map((i) => i.title),
      whereToGet: need.map((i) => ({ title: i.title, known: i.known, offers: i.offers })),
    };
  }
  if (fromGiven.length) return { summary: fromGiven[0]!, more: fromGiven.slice(1) };
  // Colton 11/23: named readings → find the actual work online; what she can't get, she asks for.
  if (policy === "find_source" && works.length) {
    const found = await Promise.all(works.map((w) => findNamedWork(w, ask).catch(() => null)));
    const got = found.filter((x): x is MaterialSummary => Boolean(x));
    const missing = works.filter((_, i) => !found[i]).map(shortWork);
    if (!got.length) return { summary: await generalBackground(a, ask, { works: [], avoid: works }), missing };
    return { summary: got[0]!, more: got.slice(1), missing };
  }
  // The assignment sheet itself, when it carries real material (an excerpt, a case, data).
  if (words(a.text) >= 350) {
    const s = await summarizeText({ kind: "assignment", title: "your assignment sheet", text: a.text, ask });
    if (s) return { summary: s };
  }
  // No reading: the one source-policy switch (lib/config/material-policy.ts) decides.
  if (policy === "uploads_only") return { summary: null, missing: works.map(shortWork) };
  if (policy === "find_source") return { summary: await generalBackground(a, ask, { works: [] }) };
  return { summary: await generalBackground(a, ask, { works: policy === "overview" ? works : [] }) };
}

/** Summary + options, once, so a lost student doesn't wait (runs after the confirm response). */
async function prefetch(supabase: SupabaseClient, paperId: string, userId: string) {
  let ctx = await readPaperContext(supabase, paperId);
  if (!bestSummary(ctx) && !ctx.missing) {
    const m = await makeSummary(supabase, paperId, ctx);
    ctx = await writePaperContext(supabase, paperId, userId, (p) => withMade(p, m));
  }
  if (!ctx.options) {
    const o = await generateOptions(await basics(supabase, paperId), ctx.readback?.ask ?? null, verifiedSummaries(ctx).flatMap((x) => x.points));
    if (o) await writePaperContext(supabase, paperId, userId, (p) => ({ ...p, options: p.options ?? o }));
  }
}

/** Every named work is a well-known one (and nothing was given): the labeled summaries, no wait. */
async function quickKnownMade(supabase: SupabaseClient, paperId: string, ctx: PaperContext): Promise<Made | null> {
  if (materialPolicy() !== "smart" || (ctx.readings ?? []).length) return null;
  const a = await basics(supabase, paperId);
  const works = a.namedWorks.slice(0, 4);
  if (!works.length || !works.every((w) => wellKnownWork(w))) return null;
  const inv = works.map((w) => {
    const chapter = chapterOf(w);
    const title = shortWork(w);
    return { title, summary: { kind: "knowledge" as const, title: chapter ? bookLevelTitle(title) : title, points: wellKnownWork(w)!.points, sources: [], at: Date.now() } };
  });
  return {
    summary: inv[0]!.summary,
    more: inv.slice(1).map((i) => i.summary),
    missing: inv.map((i) => i.title),
    whereToGet: inv.map((i) => ({ title: i.title, known: true, offers: [] })),
  };
}

function withMade(p: PaperContext, m: Made): PaperContext {
  // A later lookup for the same work replaces its summary, never doubles it.
  const fresh = m.summary ? [m.summary, ...(m.more ?? [])] : [];
  const kept = (p.summaries ?? []).filter((x) => !fresh.some((f) => f.title === x.title && f.kind === x.kind));
  const offersOld = new Map((p.whereToGet ?? []).map((w) => [w.title, w]));
  return {
    ...p,
    ...(m.summary ? { summaries: [...kept, ...fresh].slice(-8) } : {}),
    ...(m.missing ? { missing: m.missing } : {}),
    ...(m.whereToGet ? { whereToGet: m.whereToGet.map((w) => (w.offers.length ? w : { ...w, offers: offersOld.get(w.title)?.offers ?? [] })) } : {}),
  };
}

/** A reading they gave us that covers a missing named work takes it off the missing list. */
function stillMissing(missing: string[] | undefined, text: string): string[] | undefined {
  if (!missing) return missing;
  const t = text.toLowerCase();
  return missing.filter((w) => {
    const author = (w.match(/^([A-Z][\w-]+)/)?.[1] ?? "").toLowerCase();
    return !(author && t.includes(author));
  });
}

function missingAskFor(ctx: PaperContext): string | null {
  if (!ctx.missing?.length) return null;
  const ask = ctx.whereToGet?.length ? smartReadingAsk(ctx.whereToGet.filter((w) => ctx.missing!.includes(w.title))) : missingReadingAsk(ctx.missing);
  // QA 7:02 AM: a numbered chapter she can't see: ask which edition, or for its first page.
  const chapter = ctx.missing.find((m) => /\b(?:Ch\.|Chapter)\s*\d+/i.test(m));
  if (ask && chapter && !/edition/i.test(ask)) return `${ask} Chapter numbers change between editions, so tell me which edition you have, or snap the chapter's first page, and I'll match it.`;
  return ask;
}

/** QA 7:02 AM: a numbered chapter she only knows at book level: ask for the edition or the chapter's first page. */
function chapterAsk(ctx: PaperContext): string | null {
  const list = currentSummaries(ctx);
  const book = list.find((x) => x.kind === "knowledge" && /\(the book overall\)$/.test(x.title));
  if (!book) return null;
  const title = book.title.replace(/\s*\(the book overall\)$/, "");
  return `That's ${title} in general, from my own knowledge, not your edition's chapter. Chapter numbers change between editions, so tell me which edition you have, or snap the chapter's first page, and I'll match it.`;
}

/** A point cut to its first clause, at most n words (the fallback for "Say it simpler"). */
function shortPlain(p: string, n: number): string {
  const first = p.split(/(?<=[.;:])\s+|,\s+(?:which|and|but|while)\s+/)[0] ?? p;
  const w = first.replace(/\s+/g, " ").trim().split(" ");
  return w.length > n ? `${w.slice(0, n).join(" ").replace(/[,;:]$/, "")}…` : w.join(" ");
}

function publicView(ctx: PaperContext) {
  const s = bestSummary(ctx);
  return { policy: materialPolicy(), northstar: Boolean(ctx.northstar), readback: ctx.readback ?? null, summary: s, options: ctx.options ?? null, decision: ctx.decision ?? null, leader: ctx.leader ?? null, lostAtStart: Boolean(ctx.lostAtStart), materialShown: Boolean(ctx.materialShownAt), hasReading: Boolean(ctx.readings?.length), missing: ctx.missing ?? [], missingAsk: missingAskFor(ctx) ?? chapterAsk(ctx), whereToGet: (ctx.whereToGet ?? []).filter((w, i, all) => ctx.missing?.includes(w.title) && all.findIndex((x) => x.title === w.title) === i).map((w) => ({ ...w, offers: w.offers.filter((o, i, all) => all.findIndex((x) => x.url === o.url) === i) })), summaries: currentSummaries(ctx) };
}

export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if ((await getDemoSession()) || !hasSupabaseConfig()) return NextResponse.json({ ok: true, demo: true, northstar: false });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: paper } = await supabase.from("papers").select("id, current_stage").eq("id", paperId).eq("user_id", userId).maybeSingle();
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const started = Date.now();
  let cur = await readPaperContext(supabase, paperId);
  const save = async (fn: (p: PaperContext) => PaperContext) => (cur = await writePaperContext(supabase, paperId, userId, fn));

  switch (body.action) {
    case "context":
      return NextResponse.json({ ok: true, ...publicView(cur) });
    case "readback": {
      if (!cur.readback) {
        const rb = await generateReadback(await basics(supabase, paperId));
        // New papers only: a paper already past the read-back keeps its old Stage 1 plan.
        const { data: answered } = await supabase.from("paper_autosaves").select("field_key").eq("paper_id", paperId).like("field_key", "stage1:%").limit(1);
        const fresh = (paper.current_stage ?? 1) === 1 && !(answered ?? []).length;
        await save((p) => ({ ...p, northstar: p.northstar ?? fresh, ...(rb ? { readback: rb } : {}) }));
      }
      // QA 6:03 AM latency: the material lookup starts the moment the assignment is read.
      if (cur.northstar && !cur.prefetchAt) {
        await save((p) => ({ ...p, prefetchAt: Date.now() }));
        after(() => prefetch(supabase, paperId, userId).catch(() => undefined));
      }
      console.info("[brief] readback", { ms: Date.now() - started, ok: Boolean(cur.readback) });
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "confirm_readback": {
      if (cur.readback) await save((p) => ({ ...p, readback: p.readback ? { ...p.readback, confirmed: true } : p.readback }));
      if (cur.northstar && !cur.prefetchAt) after(() => prefetch(supabase, paperId, userId).catch(() => undefined));
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "material_shown":
      // The summary was shown before the confirm (QA 7:02 AM): the chat never re-asks "have you read it?".
      await save((p) => ({ ...p, materialShownAt: p.materialShownAt ?? Date.now() }));
      return NextResponse.json({ ok: true, ...publicView(cur) });
    case "lost":
      await save((p) => ({ ...p, lostAtStart: true }));
      return NextResponse.json({ ok: true });
    case "summary": {
      // QA 9:37 AM: when every named work is a well-known one, its labeled summary is
      // ready now; the read-back's lookup still adds where to get it when it lands.
      if (!bestSummary(cur) && !cur.missing) {
        const quick = await quickKnownMade(supabase, paperId, cur);
        if (quick) cur = await save((p) => (bestSummary(p) ? p : withMade(p, quick)));
      }
      // The lookup started at the read-back: wait for it instead of starting a second one.
      while (!bestSummary(cur) && !cur.missing && cur.prefetchAt && Date.now() - cur.prefetchAt < 40_000 && Date.now() - started < 30_000) {
        await new Promise((r) => setTimeout(r, 800));
        cur = await readPaperContext(supabase, paperId);
      }
      if (!bestSummary(cur) && !cur.missing) {
        const m = await makeSummary(supabase, paperId, cur);
        await save((p) => withMade(p, m));
      }
      await logSessionEvent({ paperId, stage: 1, event: "material_summary", detail: { kind: bestSummary(cur)?.kind ?? null, ms: Date.now() - started } });
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "reading": {
      const title = (body.title ?? "").trim().slice(0, 120) || "your reading";
      const text = body.text.replace(/\s+\n/g, "\n").trim().slice(0, READING_MAX_CHARS);
      if (words(text) < 40) return NextResponse.json({ error: "That reading is too short to summarize. Paste more of it, or upload the file." }, { status: 422 });
      await save((p) => ({ ...p, readings: [...(p.readings ?? []), { title, text, at: Date.now() }].slice(-3), missing: stillMissing(p.missing, text) }));
      const s = await summarizeText({ kind: "reading", title, text, ask: cur.readback?.ask ?? null });
      if (s) await save((p) => ({ ...p, summaries: [...(p.summaries ?? []), s].slice(-8) }));
      // Options built from the old material are stale once a real reading arrives (until they decide).
      if (s && !cur.decision) {
        const o = await generateOptions(await basics(supabase, paperId), cur.readback?.ask ?? null, s.points);
        if (o) await save((p) => ({ ...p, options: o }));
      }
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "reading_link": {
      const page = await fetchPageText(body.url);
      if (!page.ok)
        return NextResponse.json(
          {
            error:
              page.reason === "pdf"
                ? "That link is a PDF I can't open from here. Download it and upload the file, or take photos of the pages."
                : "I couldn't open that link. Check it, or paste the text or upload photos of the pages instead.",
          },
          { status: 422 },
        );
      const title = (page.title || body.url).slice(0, 120);
      const text = page.text.slice(0, READING_MAX_CHARS);
      await save((p) => ({ ...p, readings: [...(p.readings ?? []), { title, text, at: Date.now(), url: page.url }].slice(-3), missing: stillMissing(p.missing, `${title} ${text}`) }));
      const s = await summarizeText({ kind: "reading", title, text, ask: cur.readback?.ask ?? null, source: { title, url: page.url } });
      if (s) await save((p) => ({ ...p, summaries: [...(p.summaries ?? []), s].slice(-8) }));
      if (s && !cur.decision) {
        const o = await generateOptions(await basics(supabase, paperId), cur.readback?.ask ?? null, s.points);
        if (o) await save((p) => ({ ...p, options: o }));
      }
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "material_more": {
      const list = currentSummaries(cur);
      if (body.mode === "video") {
        const a = await basics(supabase, paperId);
        const videos = await findVideo(a.topic ?? a.prompt ?? "", list.flatMap((x) => x.points).slice(0, 8));
        return NextResponse.json({ ok: true, videos });
      }
      // QA 6:03 AM: "Say it simpler" keeps every reading: one group per summary, each still labeled.
      const groups = await Promise.all(
        list.slice(0, 4).map(async (x) => ({ title: x.title, kind: x.kind, points: (await materialMore(x.points, body.mode as "depth" | "simpler", cur.readback?.ask ?? null)) ?? [] })),
      );
      // QA 8:31 AM: a tap always appends something real. When the rewrite fails, the same points
      // come back shorter (first clause, plain), never an empty result.
      const filled = groups.map((g, i) =>
        g.points.length
          ? g
          : { ...g, points: (list[i]?.points ?? []).map((p) => shortPlain(p, body.mode === "simpler" ? 16 : 40)).filter(Boolean) },
      );
      return NextResponse.json({ ok: true, groups: filled.filter((g) => g.points.length), points: filled.flatMap((g) => g.points) });
    }
    case "options": {
      // Options come from material we have (QA 7:02 AM): wait for the lookup started at the read-back first.
      while (!cur.options && !bestSummary(cur) && !cur.missing && cur.prefetchAt && Date.now() - cur.prefetchAt < 40_000 && Date.now() - started < 30_000) {
        await new Promise((r) => setTimeout(r, 800));
        cur = await readPaperContext(supabase, paperId);
      }
      if (!cur.options) {
        const o = await generateOptions(await basics(supabase, paperId), cur.readback?.ask ?? null, verifiedSummaries(cur).flatMap((x) => x.points));
        if (o) await save((p) => ({ ...p, options: p.options ?? o }));
      }
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "decision": {
      const answer = body.answer.trim();
      if (body.slot === "leader") {
        const picked = pickFrom(answer, cur.options?.people ?? []);
        const pick = picked === "their own" && body.named?.trim() ? body.named.trim() : picked;
        await save((p) => ({ ...p, leader: { question: body.question.slice(0, 600), pick, answer, at: Date.now() } }));
        return NextResponse.json({ ok: true, ...publicView(cur) });
      }
      const pick = pickFrom(answer, cur.options?.options ?? []);
      await save((p) => ({ ...p, decision: { question: body.question.slice(0, 600), pick, answer, at: Date.now(), source: body.source ?? "asked" } }));
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
  }
}
