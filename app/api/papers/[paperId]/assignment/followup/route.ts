import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { logSessionEvent } from "@/lib/session-events";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  done: z.boolean().optional(),
  addedFiles: z.boolean().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/** Single follow-up after a thin/partial checklist — once per assignment. */
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

  await logSessionEvent({
    paperId,
    stage: 1,
    event: body.done ? "assignment_followup_done" : "assignment_followup_add_more",
    detail: {
      done: body.done ?? false,
      addedFiles: body.addedFiles ?? false,
    },
  });

  const demo = await getDemoSession();
  if (demo || !hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, demo: true, followupAsked: true });
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
    .update({
      parse_meta: { followupAsked: true, followupAt: new Date().toISOString() },
    })
    .eq("paper_id", paperId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, followupAsked: true });
}
