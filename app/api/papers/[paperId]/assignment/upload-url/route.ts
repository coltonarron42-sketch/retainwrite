import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ASSIGNMENT_ALLOWED_MIME,
  ASSIGNMENT_MAX_FILE_BYTES,
} from "@/lib/config";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { rejectedTypeMessage } from "@/lib/assignment/file-types";
import { assertUploadBatch, isAllowedAssignmentMime } from "@/lib/assignment/upload-limits";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().min(1),
  byteSize: z.number().int().positive().max(ASSIGNMENT_MAX_FILE_BYTES),
  kind: z.literal("file"),
  rightsConfirmed: z.literal(true),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Creates a pending assignment_files row and returns a resumable signed upload URL.
 * Demo sessions get a local-only token (client keeps the blob; no public URL).
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

  if (!isAllowedAssignmentMime(body.mime)) {
    return NextResponse.json(
      { error: rejectedTypeMessage(body.filename), allowed: ASSIGNMENT_ALLOWED_MIME },
      { status: 400 },
    );
  }

  const batch = assertUploadBatch(
    [],
    [{ filename: body.filename, mime: body.mime, byteSize: body.byteSize }],
  );
  if (!batch.ok) {
    return NextResponse.json({ error: batch.reason }, { status: 400 });
  }

  const demo = await getDemoSession();
  if (demo) {
    const fileId = crypto.randomUUID();
    const path = `${demo.email}/${paperId}/${fileId}-${sanitize(body.filename)}`;
    return NextResponse.json({
      fileId,
      path,
      signedUploadUrl: null,
      token: `demo:${fileId}`,
      demo: true,
      message:
        "Demo mode: keep the file locally and call finalize with extracted text; storage upload is skipped.",
    });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Use demo mode or paste." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure assignments row
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .upsert(
      { paper_id: paperId, user_id: user.id },
      { onConflict: "paper_id" },
    )
    .select("id")
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json(
      { error: assignmentError?.message ?? "Could not create assignment" },
      { status: 500 },
    );
  }

  const fileId = crypto.randomUUID();
  const path = `${user.id}/${paperId}/${fileId}-${sanitize(body.filename)}`;

  const { error: insertError } = await supabase.from("assignment_files").insert({
    id: fileId,
    assignment_id: assignment.id,
    paper_id: paperId,
    user_id: user.id,
    kind: "file",
    filename: body.filename,
    mime: body.mime,
    byte_size: body.byteSize,
    storage_path: path,
    upload_status: "pending",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("assignment-files")
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    return NextResponse.json(
      { error: signError?.message ?? "Could not create upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    fileId,
    path,
    signedUploadUrl: signed.signedUrl,
    token: signed.token,
  });
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}
