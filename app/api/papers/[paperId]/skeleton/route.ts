import { pickedLeader, pickedStyles } from "@/lib/stage1/paper-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { readPaperContext } from "@/lib/server/paper-context/store";
import { ensureOutline, ensureShape, readGhost, viewFor } from "@/lib/server/skeleton/ghost";
import { wordsTarget } from "@/lib/skeleton/shape";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ paperId: string }> };

const postSchema = z.object({
  choices: z.array(z.string().max(2000)).max(8).default([]),
  bodyNotes: z.array(z.string().max(2000)).max(20).default([]),
});

/**
 * PC-28 skeleton. GET: the paper's shape (ghost paper #1, made once the assignment is
 * confirmed). POST: adds short body titles from the student's choices (ghost paper #2).
 * Both return labels, subheadings and short titles only, never the private plan.
 */
async function handle(request: Request, ctx: Ctx, post: z.infer<typeof postSchema> | null) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ view: null, reason: "demo" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ view: null, reason: "demo" });
  const { data: paper } = await supabase.from("papers").select("id").eq("id", paperId).eq("user_id", user.id).maybeSingle();
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: asg } = await supabase
    .from("assignments")
    .select("requirements, raw_text, confirmed_at")
    .eq("paper_id", paperId)
    .maybeSingle();
  if (!asg?.confirmed_at) return NextResponse.json({ view: null, reason: "not_ready" });
  const req = (asg.requirements ?? {}) as { length?: { value?: { wordsMin?: number; wordsMax?: number; pagesMin?: number; pagesMax?: number } | null }; promptQuestion?: { value?: string | null }; topic?: { value?: string | null } };
  const text = [asg.raw_text ?? "", req.promptQuestion?.value ?? "", req.topic?.value ?? ""].filter(Boolean).join("\n");
  const words = wordsTarget({ ...(req.length?.value ?? {}), text });
  const pctx = await readPaperContext(supabase, paperId).catch(() => null);
  const material = (pctx?.summaries ?? []).map((s) => `${s.title ?? ""}: ${(s.points ?? []).join(" ")}`).join("\n");
  try {
    const existing = await readGhost(paperId);
    const shape = await ensureShape({ paperId, userId: user.id, assignmentText: text, words, material, existing });
    let outline = existing?.outline ?? null;
    // Ghost #2 (QA 1:11 AM #1): bold titles as soon as their choices lock (leader, styles), then
    // refined from their body notes (POST). A shape change re-titles; a plain GET never churns them.
    const facts = { leader: pickedLeader(pctx), styles: pickedStyles(pctx?.decision, pctx?.options?.options ?? []) };
    const choices = [...(post?.choices ?? []), pctx?.decision?.answer ?? "", pctx?.leader?.answer ?? ""].map((c) => c.trim()).filter(Boolean);
    const shapeChanged = Boolean(outline && outline.titles.some((t) => !shape.blocks.some((b) => b.key === t.key)));
    if (post || ((!outline || shapeChanged) && (facts.leader || facts.styles.length))) {
      const bodyNotes = (post?.bodyNotes ?? []).map((n) => n.trim()).filter(Boolean);
      outline = await ensureOutline({ paperId, userId: user.id, shape, facts, choices, bodyNotes, existing: post ? existing : shapeChanged ? null : existing });
    }
    return NextResponse.json({ view: viewFor(shape, outline) });
  } catch {
    return NextResponse.json({ view: null, reason: "error" });
  }
}

export async function GET(request: Request, ctx: Ctx) {
  return handle(request, ctx, null);
}

export async function POST(request: Request, ctx: Ctx) {
  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  return handle(request, ctx, body);
}
