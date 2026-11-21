import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { runHiddenDraftMilestone } from "@/lib/server/readback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  trigger: z.enum(["section_complete", "outline_approved", "draft_section_done"]),
  draftingComplete: z.boolean().optional(),
  stage: z.number().int().min(2).max(5).optional(),
  promptType: z.enum(["lesson", "personal_experience", "mixed"]),
  storyAngle: z.string().max(2000),
  thesis: z.string().max(2000),
  lessonConcept: z.string().max(500).nullable().optional(),
  sections: z
    .array(
      z.object({
        key: z.string().max(80),
        title: z.string().max(80),
        kind: z.string().max(40),
        ideas: z.array(z.string().max(600)).max(20),
      }),
    )
    .max(24),
});

const responseSchema = z.object({
  ok: z.literal(true),
  status: z.enum(["stored", "unchanged", "capped", "skipped", "failed"]),
});

type Ctx = { params: Promise<{ paperId: string }> };

/** Milestone generation. The response is a status code only. */
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
  if (!hasSupabaseConfig()) {
    return NextResponse.json(responseSchema.parse({ ok: true, status: "skipped" }));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: paper } = await supabase
    .from("papers")
    .select("id")
    .eq("id", paperId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stage = body.stage ?? (body.trigger === "draft_section_done" ? 5 : 2);
  try {
    const result = await runHiddenDraftMilestone({
      paperId,
      userId: user.id,
      trigger: body.trigger,
      draftingComplete: Boolean(body.draftingComplete),
      stage,
      ledger: {
        paperId,
        promptType: body.promptType,
        storyAngle: body.storyAngle,
        thesis: body.thesis,
        lessonConcept: body.lessonConcept ?? null,
        sections: body.sections.map((section) => ({
          key: section.key,
          title: section.title,
          kind: section.kind,
          mode: "lesson" as const,
          ideas: section.ideas,
        })),
      },
    });
    return NextResponse.json(responseSchema.parse({ ok: true, status: result.status }));
  } catch {
    return NextResponse.json(responseSchema.parse({ ok: true, status: "failed" }));
  }
}
