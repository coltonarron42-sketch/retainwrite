import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { ghostLeakCheck, type GhostScript } from "@/lib/ghost/script";
import { readGhost } from "@/lib/server/ghost/store";
import { fitJudgePrompt, fitPairIn, fitReply, knownFit, parseFitVerdict, type FitBasis, type FitVerdict } from "@/lib/stage2/fit-check";

export const runtime = "nodejs";

/**
 * PC-32 FIT CHECK (Colton t227u): is the leader they picked well supported for the style they
 * picked? Known pairs answer from the table (no model call); others get one fast verdict, using
 * the research the hidden ghost already gathered (source titles only). Pau's words always come
 * from the table (R2), never from the ghost; the reply still passes the coaching and ghost gates.
 * // SOP: coaching only, never generate submission text
 */
const bodySchema = z.object({
  note: z.string().min(1).max(4000),
  sheet: z.string().max(20000).optional(),
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
  const pair = fitPairIn(body.note, body.sheet ?? "");
  if (!pair) return NextResponse.json({ pair: null, verdict: null, paras: [] });
  const started = Date.now();
  let ghost: GhostScript | null = null;
  if (!(await getDemoSession()) && hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [{ data: paper }, g] = await Promise.all([
      supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle(),
      readGhost(supabase, paperId).catch(() => null),
    ]);
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    ghost = g;
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
  if (ghost && paras.some((p) => !ghostLeakCheck(p, ghost!, body.note).ok)) paras = [];
  console.info("[coach-fit]", { verdict, basis, ms: Date.now() - started, ok: paras.length > 0, ghost: Boolean(ghost) });
  return NextResponse.json({ pair, verdict, paras });
}
