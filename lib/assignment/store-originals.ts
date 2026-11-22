"use client";

import type { StagedAssignmentFile } from "@/components/stages/stage1/upload-panel";
import { createClient } from "@/lib/supabase/client";

/**
 * Keep a private copy of each uploaded file in the assignment-files bucket
 * (signed upload URL, owner-only path) and record its extracted text.
 * Runs in the background: reading the assignment never waits on it.
 */
export async function storeOriginals(paperId: string, files: StagedAssignmentFile[]) {
  // Saved web pages are kept as extracted text only, never as stored HTML.
  const ready = files.filter((f) => f.status === "ready" && f.kind !== "html");
  if (!ready.length) return;
  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return;
  }
  await Promise.all(
    ready.map(async (f) => {
      const blob = f.uploadBlob ?? f.file;
      const mime = f.uploadBlob ? "image/jpeg" : f.mime;
      const filename = f.uploadBlob ? f.filename.replace(/\.[^.]+$/, "") + ".jpg" : f.filename;
      try {
        const res = await fetch(`/api/papers/${paperId}/assignment/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, mime, byteSize: blob.size, kind: "file", rightsConfirmed: true }),
        });
        const data = (await res.json().catch(() => null)) as
          | { fileId?: string; path?: string; token?: string; demo?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.fileId || !data.path || !data.token || data.demo) {
          if (!res.ok) console.warn("[upload] no upload url", { status: res.status });
          return;
        }
        const { error } = await supabase.storage
          .from("assignment-files")
          .uploadToSignedUrl(data.path, data.token, blob, { contentType: mime });
        if (error) {
          console.warn("[upload] storage upload failed", { message: error.message });
          return;
        }
        await fetch(`/api/papers/${paperId}/assignment/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: data.fileId,
            extractedText: f.extractedText.slice(0, 500_000),
            extractionMethod: f.method,
            clientMime: mime,
          }),
        });
      } catch {
        console.warn("[upload] storage copy skipped");
      }
    }),
  );
}
