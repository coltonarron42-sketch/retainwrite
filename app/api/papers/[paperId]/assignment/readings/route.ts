import { NextResponse } from "next/server";
import { z } from "zod";
import { checkLink } from "@/lib/assignment/link-check";
import { providedReadingSchema } from "@/lib/assignment/schema";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), url: z.string().max(2000) }),
  z.object({ action: z.literal("save"), readings: z.array(providedReadingSchema).max(30) }),
]);

type Ctx = { params: Promise<{ paperId: string }> };

async function owner(paperId: string) {
  const demo = await getDemoSession();
  if (demo) return { kind: "demo" as const };
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;
  const { data: paper } = await supabase.from("papers").select("id").eq("id", paperId).eq("user_id", userId).maybeSingle();
  if (!paper) return null;
  return { kind: "user" as const, supabase, userId };
}

/**
 * Sources the student gives Pau after the read: check that a link opens,
 * and keep the list on the saved assignment so a reload doesn't ask again.
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
  const who = await owner(paperId);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (body.action === "check") {
    const result = await checkLink(body.url);
    console.info("[readings] link check", { ok: result.ok, reason: result.ok ? null : result.reason });
    return NextResponse.json(result);
  }

  if (who.kind === "demo") return NextResponse.json({ ok: true, saved: false });
  const { data: row, error: readError } = await who.supabase
    .from("assignments")
    .select("requirements")
    .eq("paper_id", paperId)
    .eq("user_id", who.userId)
    .maybeSingle();
  if (readError || !row?.requirements) {
    return NextResponse.json({ error: "Couldn't save that source yet." }, { status: 409 });
  }
  const requirements = row.requirements as Record<string, unknown>;
  const field = {
    ...((requirements.providedReadings as Record<string, unknown> | undefined) ?? {}),
    value: body.readings,
    confidence: 1,
    source: "student_entered",
    confirmed: true,
  };
  const { error } = await who.supabase
    .from("assignments")
    .update({ requirements: { ...requirements, providedReadings: field, providedSources: field }, updated_at: new Date().toISOString() })
    .eq("paper_id", paperId)
    .eq("user_id", who.userId);
  if (error) {
    console.error("[readings] save failed", { code: error.code });
    return NextResponse.json({ error: "Couldn't save that source." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: true });
}
