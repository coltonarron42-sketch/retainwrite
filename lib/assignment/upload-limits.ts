import {
  ASSIGNMENT_ALLOWED_MIME,
  ASSIGNMENT_MAX_FILE_BYTES,
  ASSIGNMENT_MAX_FILES,
  ASSIGNMENT_MAX_TOTAL_BYTES,
} from "@/lib/config";
import { mimeFromName, rejectedTypeMessage } from "@/lib/assignment/file-types";

export type UploadCandidate = {
  filename: string;
  mime: string;
  byteSize: number;
};

export type UploadLimitResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Kept for callers; .doc is now read (best effort) instead of rejected. */
export function rejectLegacyDoc(filename: string): string | null {
  void filename;
  return null;
}

export function guessMimeFromFilename(filename: string): string | null {
  return mimeFromName(filename);
}

export function isAllowedAssignmentMime(mime: string): boolean {
  return (ASSIGNMENT_ALLOWED_MIME as readonly string[]).includes(mime.split(";")[0]!.trim().toLowerCase());
}

export function assertUploadBatch(
  existing: UploadCandidate[],
  incoming: UploadCandidate[],
): UploadLimitResult {
  for (const file of incoming) {
    const legacy = rejectLegacyDoc(file.filename);
    if (legacy) return { ok: false, reason: legacy };

    // Trust a known extension over a vague browser type (e.g. octet-stream).
    const byName = guessMimeFromFilename(file.filename);
    const mime = isAllowedAssignmentMime(file.mime) ? file.mime : byName ?? file.mime ?? "";
    if (!isAllowedAssignmentMime(mime)) {
      return { ok: false, reason: rejectedTypeMessage(file.filename) };
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
