import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ paperId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) {
    return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  }

  const demo = await getDemoSession();
  if (demo) {
    return NextResponse.json({
      parseStatus: "idle",
      files: [],
      needsRetake: [],
      demo: true,
    });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("parse_status")
    .eq("paper_id", paperId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: files } = await supabase
    .from("assignment_files")
    .select(
      "id, filename, sort_order, upload_status, pages, ocr_method, ocr_confidence, quality_score",
    )
    .eq("paper_id", paperId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({
    parseStatus: assignment?.parse_status ?? "idle",
    files: (files ?? []).map((f) => ({
      id: f.id,
      filename: f.filename,
      sortOrder: f.sort_order,
      uploadStatus: f.upload_status,
      pages: f.pages,
      ocrMethod: f.ocr_method,
      ocrConfidence: f.ocr_confidence,
      qualityScore: f.quality_score,
    })),
    needsRetake: [],
  });
}
