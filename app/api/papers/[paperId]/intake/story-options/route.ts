import { NextResponse } from "next/server";
import { z } from "zod";
import { buildStoryAngleFallback } from "@/lib/stage1/story-angles";
import { getDemoSession } from "@/lib/demo/session-server";
import { logSessionEvent } from "@/lib/session-events";

export const runtime = "nodejs";

// Student answers run long (the early take is a few sentences): clip them,
// never reject the request (QA 12:25 #2: a 300-char answer returned 400).
const bodySchema = z.object({
  topic: z.string().max(4000).transform((v) => v.slice(0, 500)).optional(),
  studentPhrases: z
    .array(z.string().max(8000).transform((v) => v.slice(0, 400)))
    .max(100)
    .transform((list) => list.slice(0, 20))
    .optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Return 3–4 story angles. Grok path can plug in later; rule fallback always works.
 * // SOP: coaching only, never generate submission text
 */
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

  const angles = buildStoryAngleFallback({
    topic: body.topic || "this assignment",
    studentPhrases: body.studentPhrases ?? [],
  });

  await logSessionEvent({
    paperId,
    stage: 1,
    event: "story_options_shown",
    detail: { count: angles.length, fallback: true },
  });

  const demo = await getDemoSession();
  return NextResponse.json({
    angles,
    demo: Boolean(demo),
    fallback: true,
  });
}
