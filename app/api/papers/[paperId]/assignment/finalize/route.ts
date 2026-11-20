import { NextResponse } from "next/server";
import { z } from "zod";
import { parseLinkField } from "@/lib/assignment/provided-sources";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  fileId: z.string().uuid().optional(),
  pasteText: z.string().max(200_000).optional(),
  links: z.array(z.string().min(1).max(2000)).max(15).optional(),
  /** Demo / local extract path when storage is skipped. */
  extractedText: z.string().max(500_000).optional(),
  extractionMethod: z
    .enum([
      "pdf_text",
      "docx",
      "txt",
      "ocr_mistral",
      "ocr_grok_vision",
      "paste",
      "fetch",
      "manual",
    ])
    .optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * After upload (or for paste/links): mark file ready, store paste/link rows.
 * Does not finish OCR inline — kicks extraction and returns quickly.
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

  if (!body.fileId && !body.pasteText?.trim() && !(body.links && body.links.length)) {
    return NextResponse.json(
      { error: "Provide fileId, pasteText, or links" },
      { status: 400 },
    );
  }

  const demo = await getDemoSession();
  if (demo) {
    const links = body.links ? parseLinkField(body.links.join("\n")) : [];
    return NextResponse.json({
      ok: true,
      demo: true,
      fileId: body.fileId ?? null,
      uploadStatus: "ready",
      pasteStored: Boolean(body.pasteText?.trim()),
      linksStored: links.length,
      extractedPreview: (body.extractedText || body.pasteText || "").slice(0, 200),
      message: "Demo finalize accepted — client continues with local parse.",
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

  if (body.fileId) {
    const { error } = await supabase
      .from("assignment_files")
      .update({
        upload_status: "ready",
        extracted_text: body.extractedText ?? null,
        extraction_method: body.extractionMethod ?? null,
        exif_stripped: true,
      })
      .eq("id", body.fileId)
      .eq("user_id", user.id)
      .eq("paper_id", paperId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Paste / links: assignment row must exist
  const { data: assignment } = await supabase
    .from("assignments")
    .upsert({ paper_id: paperId, user_id: user.id }, { onConflict: "paper_id" })
    .select("id")
    .single();

  if (assignment && body.pasteText?.trim()) {
    await supabase.from("assignment_files").insert({
      assignment_id: assignment.id,
      paper_id: paperId,
      user_id: user.id,
      kind: "paste",
      extracted_text: body.pasteText.trim(),
      extraction_method: "paste",
      upload_status: "ready",
    });
  }

  if (assignment && body.links?.length) {
    const rows = body.links.map((url, i) => ({
      assignment_id: assignment.id,
      paper_id: paperId,
      user_id: user.id,
      kind: "link" as const,
      url,
      sort_order: 1000 + i,
      upload_status: "ready" as const,
      extraction_method: "manual" as const,
    }));
    await supabase.from("assignment_files").insert(rows);
  }

  return NextResponse.json({
    ok: true,
    fileId: body.fileId ?? null,
    uploadStatus: "ready",
  });
}
