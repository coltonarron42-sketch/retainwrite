import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { ghostLeakCheck, type GhostScript } from "@/lib/ghost/script";
import { readGhost } from "@/lib/server/ghost/store";
import { chosenStyles } from "@/lib/stage1/north-turns";
import { fitJudgePrompt, fitKey, fitPairIn, fitReply, knownFit, parseFitVerdict, type FitBasis, type FitPair, type FitVerdict } from "@/lib/stage2/fit-check";

export const runtime = "nodejs";

/**
 * PC-32 FIT CHECK (Colton t227u): is the leader they picked well supported for the style they
 * picked? Known pairs answer from the table (no model call); others get one fast verdict, using
 * the research the hidden ghost already gathered (source titles only). Pau's words always come
 * from the table (R2), never from the ghost; the reply still passes the coaching and ghost gates.
 * Once per pair (QA 4:57 PM): each result is kept server-side, so a reload or a repeat gets the
 * same lines back without a new check.
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.object({
  pair: z.object({ style: z.string().min(3).max(40), leader: z.string().min(2).max(60) }).optional(),
  note: z.string().min(1).max(4000).optional(),
  sheet: z.string().max(20000).optional(),
  source: z.enum(["entry", "note"]).optional(),
});

/** Server-only row (hidden from autosave reads and writes like every server:* key). */
const FIT_FIELD = "server:fit_checks";
type Stored = Record<string, { verdict: FitVerdict; paras: string[]; at: number }>;

async function readFits(supabase: SupabaseClient, paperId: string): Promise<Stored> {
  try {
    const { data } = await supabase.from("paper_autosaves").select("draft_text").eq("paper_id", paperId).eq("field_key", FIT_FIELD).maybeSingle();
    return data?.draft_text ? (JSON.parse(data.draft_text as string) as Stored) : {};
  } catch {
    return {};
  }
}

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
  // A pair sent by the client must name a real style; else it's read from the note.
  const sent: FitPair | null = body.pair && chosenStyles([body.pair.style])[0] ? { style: chosenStyles([body.pair.style])[0]!.toLowerCase(), leader: body.pair.leader.trim() } : null;
  const pair = sent ?? (body.note ? fitPairIn(body.note, body.sheet ?? "") : null);
  if (!pair) return NextResponse.json({ pair: null, verdict: null, paras: [] });
  const key = fitKey(pair);
  const started = Date.now();
  let ghost: GhostScript | null = null;
  let supabase: SupabaseClient | null = null;
  let userId: string | null = null;
  let stored: Stored = {};
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    supabase = (await createClient()) as unknown as SupabaseClient;
    const { data: claims } = await supabase.auth.getClaims();
    userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [{ data: paper }, s] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      readFits(supabase, paperId),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    stored = s;
    const hit = stored[key];
    if (hit) {
      console.info("[coach-fit]", { verdict: hit.verdict, source: body.source ?? "note", cached: true, ms: Date.now() - started });
      return NextResponse.json({ pair, verdict: hit.verdict, paras: hit.paras, cached: true });
    }
    ghost = await readGhost(supabase, paperId).catch(() => null);
  }
  let verdict: FitVerdict = knownFit(pair) ?? "unsure";
  let basis: FitBasis = knownFit(pair) ? "known" : "general";
  if (basis !== "known") {
    const research = ghost ? ghost.sources.map((x) => `- ${x.title}`).join("\n") : "";
    const q = fitJudgePrompt(pair, research);
    const res = await grokChatJson({
      model: MODEL_FAST,
      system: q.system,
      user: q.user,
      jsonSchema: {
        name: "fit_verdict",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { verdict: { type: "string", enum: ["strong", "weak", "unsure"] } },
          required: ["verdict"],
        },
      },
      timeoutMs: 7_000,
    });
    verdict = res.ok ? parseFitVerdict(res.text) : "unsure";
    basis = research ? "research" : "general";
  }
  let paras = fitReply(pair, verdict);
  if (paras.some((p) => !assertCoachingOnly(p).ok)) paras = [];
  if (ghost && paras.some((p) => !ghostLeakCheck(p, ghost!, `${body.note ?? ""}\n${pair.style} ${pair.leader}`).ok)) paras = [];
  if (supabase && userId && paras.length) {
    const next: Stored = { ...stored, [key]: { verdict, paras, at: Date.now() } };
    await supabase
      .from("paper_autosaves")
      .upsert({ paper_id: paperId, user_id: userId, field_key: FIT_FIELD, draft_text: JSON.stringify(next), submitted: false, updated_at: new Date().toISOString() }, { onConflict: "paper_id,field_key" });
  }
  console.info("[coach-fit]", { verdict, basis, source: body.source ?? "note", cached: false, ms: Date.now() - started, ok: paras.length > 0, ghost: Boolean(ghost) });
  return NextResponse.json({ pair, verdict, paras });
}
