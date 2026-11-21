import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { buildStudentReadback } from "@/lib/server/readback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  ideas: z
    .array(z.object({ id: z.string().max(120), text: z.string().max(600), sectionKey: z.string().max(80) }))
    .max(40),
  labels: z.array(z.object({ key: z.string().max(80), title: z.string().max(80) })).max(24).optional(),
});

const responseSchema = z.object({
  ideas: z.array(z.object({ id: z.string(), text: z.string(), sectionKey: z.string() })).max(40),
  flags: z
    .array(
      z.object({
        kind: z.enum(["placement", "weight", "pacing", "gap"]),
        text: z.string().max(180),
        ideaId: z.string(),
      }),
    )
    .max(2),
});

type Ctx = { params: Promise<{ paperId: string }> };

/** Student ideas and scripted flags only. Hidden-draft prose never leaves the server. */
export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) {
    return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const fallback = { ideas: body.ideas, flags: [] as [] };
  if (!hasSupabaseConfig()) return NextResponse.json(responseSchema.parse(fallback));

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(responseSchema.parse(fallback));
    const { data: paper } = await supabase
      .from("papers")
      .select("id")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!paper) return NextResponse.json(responseSchema.parse(fallback));

    const labels = Object.fromEntries((body.labels ?? []).map((row) => [row.key, row.title]));
    const shaped = await buildStudentReadback({
      paperId,
      ideas: body.ideas,
      labels,
      studentCorpus: body.ideas.map((idea) => idea.text).join("\n"),
    });
    return NextResponse.json(
      responseSchema.parse({
        ideas: shaped.ideas.map((idea) => ({
          id: idea.id,
          text: idea.text,
          sectionKey: idea.sectionKey,
        })),
        flags: shaped.flags.slice(0, 2).map((flag) => ({
          kind: flag.kind,
          text: flag.text,
          ideaId: flag.ideaId,
        })),
      }),
    );
  } catch {
    return NextResponse.json(responseSchema.parse(fallback));
  }
}
