import {
  ASSIGNMENT_ALLOWED_MIME,
  ASSIGNMENT_MAX_FILE_BYTES,
  ASSIGNMENT_MAX_FILES,
  ASSIGNMENT_MAX_TOTAL_BYTES,
} from "@/lib/config";

export type UploadCandidate = {
  filename: string;
  mime: string;
  byteSize: number;
};

export type UploadLimitResult =
  | { ok: true }
  | { ok: false; reason: string };

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".gif": "image/gif",
};

export function rejectLegacyDoc(filename: string): string | null {
  if (filename.toLowerCase().endsWith(".doc") && !filename.toLowerCase().endsWith(".docx")) {
    return "Save or export this as a PDF or a .docx and try again.";
  }
  return null;
}

export function guessMimeFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [ext, mime] of Object.entries(EXT_MIME)) {
    if (lower.endsWith(ext)) return mime;
  }
  return null;
}

export function isAllowedAssignmentMime(mime: string): boolean {
  return (ASSIGNMENT_ALLOWED_MIME as readonly string[]).includes(mime);
}

export function assertUploadBatch(
  existing: UploadCandidate[],
  incoming: UploadCandidate[],
): UploadLimitResult {
  for (const file of incoming) {
    const legacy = rejectLegacyDoc(file.filename);
    if (legacy) return { ok: false, reason: legacy };

    const mime = file.mime || guessMimeFromFilename(file.filename) || "";
    if (!isAllowedAssignmentMime(mime)) {
      return {
        ok: false,
        reason: `${file.filename} isn’t a supported type. Use PDF, Word, text, or an image.`,
      };
    }
    if (file.byteSize <= 0) {
      return { ok: false, reason: `${file.filename} looks empty.` };
    }
    if (file.byteSize > ASSIGNMENT_MAX_FILE_BYTES) {
      return {
        ok: false,
        reason: `${file.filename} is over 25 MB. Compress it or split the pages.`,
      };
    }
  }

  const totalCount = existing.length + incoming.length;
  if (totalCount > ASSIGNMENT_MAX_FILES) {
    return {
      ok: false,
      reason: `You can attach up to ${ASSIGNMENT_MAX_FILES} files.`,
    };
  }

  const totalBytes =
    existing.reduce((s, f) => s + f.byteSize, 0) +
    incoming.reduce((s, f) => s + f.byteSize, 0);
  if (totalBytes > ASSIGNMENT_MAX_TOTAL_BYTES) {
    return {
      ok: false,
      reason: "All files together can’t exceed 100 MB.",
    };
  }

  return { ok: true };
}
