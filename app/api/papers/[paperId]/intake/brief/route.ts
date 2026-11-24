import { after, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { logSessionEvent } from "@/lib/session-events";
import { readPaperContext, writePaperContext } from "@/lib/server/paper-context/store";
import { findNamedWork, generalBackground, generateOptions, generateReadback, shortWork, summarizeText, type AssignmentBasics } from "@/lib/server/paper-context/brief";
import { fetchPageText } from "@/lib/server/paper-context/fetch-page";
import { materialPolicy, missingReadingAsk } from "@/lib/config/material-policy";
import { bestSummary, pickFrom, READING_MAX_CHARS, type MaterialSummary, type PaperContext } from "@/lib/stage1/paper-context";

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
  z.object({ action: z.literal("decision"), question: z.string().max(2000), answer: z.string().min(1).max(20_000) }),
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
    namedWorks: (src?.notes ?? "")
      .replace(/^\s*must (include|use|cite):?\s*/i, "")
      .split(/;\s*/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 6),
    sources: src ? [src.countMin ? `at least ${src.countMin}` : null, src.types, src.notes].filter(Boolean).join(", ") || null : null,
    length: len?.raw ?? (len?.wordsMin ? `${len.wordsMin}-${len.wordsMax ?? ""} words` : null),
    text: (asg?.raw_text as string | null) || (paper?.assignment_prompt as string | null) || "",
  };
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

type Made = { summary: MaterialSummary | null; missing?: string[] };

async function makeSummary(supabase: SupabaseClient, paperId: string, ctx: PaperContext): Promise<Made> {
  const a = await basics(supabase, paperId);
  const ask = ctx.readback?.ask ?? null;
  const reading = ctx.readings?.at(-1);
  if (reading)
    return { summary: await summarizeText({ kind: "reading", title: reading.title, text: reading.text, ask, source: reading.url ? { title: reading.title, url: reading.url } : undefined }) };
  const policy = materialPolicy();
  // Colton 11/23: named readings → find the actual work online; what she can't get, she asks for.
  if (policy === "find_source" && a.namedWorks.length) {
    const works = a.namedWorks.slice(0, 3);
    const found = await Promise.all(works.map((w) => findNamedWork(w, ask).catch(() => null)));
    const got = found.filter((x): x is MaterialSummary => Boolean(x));
    const missing = works.filter((_, i) => !found[i]).map(shortWork);
    // Nothing found: she can still teach the general ideas the assignment itself names (never "what the reading says").
    if (!got.length) return { summary: await generalBackground(a, ask, { works: [], avoid: works }), missing };
    const summary: MaterialSummary =
      got.length === 1
        ? got[0]!
        : {
            kind: "found",
            title: got.map((g) => g.title).join(" and "),
            points: got.flatMap((g) => g.points.slice(0, 4).map((p) => `${g.title}: ${p}`)),
            sources: got.flatMap((g) => g.sources),
            at: Date.now(),
          };
    return { summary, missing };
  }
  // The assignment sheet itself, when it carries real material (an excerpt, a case, data).
  if (words(a.text) >= 350) {
    const s = await summarizeText({ kind: "assignment", title: "your assignment sheet", text: a.text, ask });
    if (s) return { summary: s };
  }
  // No reading: the one source-policy switch (lib/config/material-policy.ts) decides.
  if (policy === "uploads_only") return { summary: null, missing: a.namedWorks.map(shortWork) };
  if (policy === "find_source") return { summary: await generalBackground(a, ask, { works: [] }) }; // nothing named: topic background
  return { summary: await generalBackground(a, ask, { works: policy === "overview" ? a.namedWorks : [] }) };
}

/** Summary + options, once, so a lost student doesn't wait (runs after the confirm response). */
async function prefetch(supabase: SupabaseClient, paperId: string, userId: string) {
  let ctx = await readPaperContext(supabase, paperId);
  if (!bestSummary(ctx) && !ctx.missing) {
    const m = await makeSummary(supabase, paperId, ctx);
    ctx = await writePaperContext(supabase, paperId, userId, (p) => withMade(p, m));
  }
  if (!ctx.options) {
    const o = await generateOptions(await basics(supabase, paperId), ctx.readback?.ask ?? null, bestSummary(ctx)?.points ?? []);
    if (o) await writePaperContext(supabase, paperId, userId, (p) => ({ ...p, options: p.options ?? o }));
  }
}

function withMade(p: PaperContext, m: Made): PaperContext {
  return {
    ...p,
    ...(m.summary ? { summaries: [...(p.summaries ?? []), m.summary].slice(-3) } : {}),
    ...(m.missing ? { missing: m.missing } : {}),
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

function publicView(ctx: PaperContext) {
  const s = bestSummary(ctx);
  return { policy: materialPolicy(), northstar: Boolean(ctx.northstar), readback: ctx.readback ?? null, summary: s, options: ctx.options ?? null, decision: ctx.decision ?? null, lostAtStart: Boolean(ctx.lostAtStart), hasReading: Boolean(ctx.readings?.length), missing: ctx.missing ?? [], missingAsk: ctx.missing?.length ? missingReadingAsk(ctx.missing) : null };
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
      console.info("[brief] readback", { ms: Date.now() - started, ok: Boolean(cur.readback) });
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "confirm_readback": {
      if (cur.readback) await save((p) => ({ ...p, readback: p.readback ? { ...p.readback, confirmed: true } : p.readback }));
      if (cur.northstar) after(() => prefetch(supabase, paperId, userId).catch(() => undefined));
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "lost":
      await save((p) => ({ ...p, lostAtStart: true }));
      return NextResponse.json({ ok: true });
    case "summary": {
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
      if (s) await save((p) => ({ ...p, summaries: [...(p.summaries ?? []), s].slice(-3) }));
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
      if (s) await save((p) => ({ ...p, summaries: [...(p.summaries ?? []), s].slice(-3) }));
      if (s && !cur.decision) {
        const o = await generateOptions(await basics(supabase, paperId), cur.readback?.ask ?? null, s.points);
        if (o) await save((p) => ({ ...p, options: o }));
      }
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "options": {
      if (!cur.options) {
        const o = await generateOptions(await basics(supabase, paperId), cur.readback?.ask ?? null, bestSummary(cur)?.points ?? []);
        if (o) await save((p) => ({ ...p, options: p.options ?? o }));
      }
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
    case "decision": {
      const answer = body.answer.trim();
      const pick = pickFrom(answer, cur.options?.options ?? []);
      await save((p) => ({ ...p, decision: { question: body.question.slice(0, 600), pick, answer, at: Date.now() } }));
      return NextResponse.json({ ok: true, ...publicView(cur) });
    }
  }
}
