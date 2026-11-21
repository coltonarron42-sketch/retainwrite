import { NextResponse } from "next/server";
import { z } from "zod";
import { assertStoryAngleQuestion } from "@/lib/stage1/story-angles";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import { createClient } from "@/lib/supabase/server";
import { wordCount } from "@/lib/utils";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
  source: z.enum(["ai", "student"]),
  angleId: z.string().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

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

  if (body.source === "student") {
    if (wordCount(body.text) < 15) {
      return NextResponse.json(
        { error: "Write at least 15 words for your own angle" },
        { status: 400 },
      );
    }
  } else if (!assertStoryAngleQuestion(body.text) && !body.text.trim()) {
    return NextResponse.json({ error: "Invalid story angle" }, { status: 400 });
  }

  const storyAngle = { text: body.text.trim(), source: body.source };

  await logSessionEvent({
    paperId,
    stage: 1,
    event: body.source === "student" ? "story_angle_own" : "story_angle_picked",
    detail: { angleId: body.angleId ?? null, source: body.source },
  });

  const demo = await getDemoSession();
  if (demo || !hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, demo: true, storyAngle });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("assignments")
    .update({ story_angle: storyAngle })
    .eq("paper_id", paperId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, storyAngle });
}
