"use client";

import { useCallback, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { dsLabel, dsTextarea } from "@/lib/ds/classes";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractFileText, KIND_LABEL, type FileKind } from "@/lib/assignment/client-extract";
import {
  assertUploadBatch,
  guessMimeFromFilename,
} from "@/lib/assignment/upload-limits";
import { ASSIGNMENT_MAX_FILES } from "@/lib/config";
import { cn } from "@/lib/utils";

export type StagedAssignmentFile = {
  id: string;
  file: File;
  filename: string;
  mime: string;
  byteSize: number;
  previewUrl?: string;
  extractedText: string;
  /** One state at a time: reading (spinner), ready, or failed (with Retry). */
  status: "reading" | "ready" | "failed";
  kind?: FileKind;
  error?: string;
  method: string;
  /** Photos: the re-encoded JPEG (EXIF dropped) used for the storage copy. */
  uploadBlob?: Blob;
};

/** Read one staged file and write its result back into the list. */
export async function extractStagedFile(
  paperId: string,
  id: string,
  file: File,
  setFiles: Dispatch<SetStateAction<StagedAssignmentFile[]>>,
) {
  setFiles((prev) =>
    prev.map((f) => (f.id === id ? { ...f, status: "reading", error: undefined } : f)),
  );
  const result = await extractFileText(paperId, file);
  setFiles((prev) =>
    prev.map((f) => {
      if (f.id !== id) return f;
      if (!result.ok) {
        return { ...f, kind: result.kind, status: "failed", error: result.error, extractedText: "" };
      }
      return {
        ...f,
        kind: result.kind,
        status: "ready",
        error: undefined,
        extractedText: result.text,
        method: result.method,
        uploadBlob: result.uploadBlob,
      };
    }),
  );
}

function statusLine(f: StagedAssignmentFile): string {
  const label = KIND_LABEL[f.kind ?? "unknown"];
  if (f.status === "reading") {
    return f.kind === "photo" || f.method === "ocr_grok_vision"
      ? `Reading this ${label}… this can take up to 30 seconds`
      : `Reading this ${label}…`;
  }
  if (f.status === "failed") return f.error ?? `We couldn't read this ${label}.`;
  const words = f.extractedText.split(/\s+/).filter(Boolean).length;
  return `Read · ${words} words from this ${label}`;
}

type Props = {
  paperId: string;
  files: StagedAssignmentFile[];
  onFilesChange: Dispatch<SetStateAction<StagedAssignmentFile[]>>;
  paste: string;
  onPasteChange: (value: string) => void;
  links: string;
  onLinksChange: (value: string) => void;
  rightsOk: boolean;
  onRightsOkChange: (value: boolean) => void;
  error: string | null;
  onError: (message: string | null) => void;
  onRetryFile?: (id: string) => void;
};

const ACCEPT =
  ".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,image/*";

function newId() {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

export function UploadPanel({
  paperId,
  files,
  onFilesChange,
  paste,
  onPasteChange,
  links,
  onLinksChange,
  rightsOk,
  onRightsOkChange,
  error,
  onError,
  onRetryFile,
}: Props) {
  const fileInputId = useId();
  const cameraInputId = useId();
  const galleryInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

  const ingestFiles = useCallback(
    async (list: FileList | File[]) => {
      onError(null);
      const incoming = Array.from(list);
      if (incoming.length === 0) return;

      const candidates = incoming.map((f) => ({
        filename: f.name,
        mime: f.type || guessMimeFromFilename(f.name) || "application/octet-stream",
        byteSize: f.size,
      }));
      const existing = files.map((f) => ({
        filename: f.filename,
        mime: f.mime,
        byteSize: f.byteSize,
      }));
      const check = assertUploadBatch(existing, candidates);
      if (!check.ok) {
        onError(check.reason);
        return;
      }

      setBusy(true);
      const staged: StagedAssignmentFile[] = incoming.map((file) => {
        const mime = file.type || guessMimeFromFilename(file.name) || "application/octet-stream";
        return {
          id: newId(),
          file,
          filename: file.name,
          mime,
          byteSize: file.size,
          previewUrl: mime.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          extractedText: "",
          status: "reading",
          method: "manual",
        };
      });
      onFilesChange((prev) => [...prev, ...staged]);
      setBusy(false);
      await Promise.all(
        staged.map((item) => extractStagedFile(paperId, item.id, item.file, onFilesChange)),
      );
    },
    [files, onError, onFilesChange, paperId],
  );

  function removeFile(id: string) {
    const next = files.filter((f) => f.id !== id);
    const removed = files.find((f) => f.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onFilesChange(next);
  }

  function moveFile(id: string, dir: -1 | 1) {
    const idx = files.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    const [item] = next.splice(idx, 1);
    next.splice(j, 0, item);
    onFilesChange(next);
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "rounded-[12px] border-2 border-dashed px-6 py-8 text-center transition-colors duration-150",
          dragging
            ? "border-ds-accent bg-ds-surface"
            : "border-ds-border bg-ds-surface",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void ingestFiles(e.dataTransfer.files);
        }}
      >
        <p className="font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">
          Drop the assignment here
        </p>
        <p className="mt-2 text-[16px] text-ds-muted">
          PDF, Word, text, or photos — up to {ASSIGNMENT_MAX_FILES} files, 25 MB
          each.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <DsButton
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Choose files
          </DsButton>
          <DsButton
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
          >
            Photo library
          </DsButton>
          <DsButton
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            Take a photo
          </DsButton>
        </div>
        <input
          id={fileInputId}
          ref={fileRef}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          multiple
          onChange={(e) => {
            if (e.target.files) void ingestFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          id={galleryInputId}
          ref={galleryRef}
          type="file"
          className="sr-only"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files) void ingestFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          id={cameraInputId}
          ref={cameraRef}
          type="file"
          className="sr-only"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files) void ingestFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={f.id}
              className="flex items-center gap-4 rounded-[8px] border border-ds-border bg-ds-surface px-4 py-2"
            >
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.previewUrl}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-ds-page text-[13px] font-semibold uppercase text-ds-muted">
                  {f.filename.split(".").pop()?.slice(0, 4) || "file"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-medium text-ds-ink">
                  {f.filename}
                </p>
                <p
                  className={cn(
                    "flex items-center gap-2 text-[13px] leading-[1.6]",
                    f.status === "failed" ? "text-ds-error" : "text-ds-muted",
                  )}
                  role={f.status === "failed" ? "alert" : "status"}
                >
                  {f.status === "reading" ? (
                    <span
                      aria-hidden
                      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ds-border border-t-ds-accent"
                    />
                  ) : null}
                  <span>
                    {(f.byteSize / 1024).toFixed(0)} KB · {statusLine(f)}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {f.status === "failed" && onRetryFile ? (
                  <DsButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onRetryFile(f.id)}
                  >
                    Retry
                  </DsButton>
                ) : null}
                <DsButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={i === 0}
                  aria-label="Move earlier"
                  onClick={() => moveFile(f.id, -1)}
                >
                  ↑
                </DsButton>
                <DsButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={i === files.length - 1}
                  aria-label="Move later"
                  onClick={() => moveFile(f.id, 1)}
                >
                  ↓
                </DsButton>
                <DsButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${f.filename}`}
                  onClick={() => removeFile(f.id)}
                >
                  ✕
                </DsButton>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <Label className={dsLabel} htmlFor="links">Any links your professor gave you?</Label>
        <Textarea
          className={dsTextarea}
          id="links"
          value={links}
          onChange={(e) => onLinksChange(e.target.value)}
          rows={2}
          placeholder="https://… (one per line, optional)"
        />
      </div>

      <div>
        <button
          type="button"
          className="ds-focus rounded-[4px] text-[16px] font-semibold text-ds-ink underline underline-offset-4 transition-colors duration-150 hover:text-ds-muted"
          onClick={() => setShowPaste((v) => !v)}
        >
          {showPaste ? "Hide optional text" : "Add assignment text (optional)"}
        </button>
        {showPaste ? (
          <div className="mt-2 space-y-2">
            <Label className={dsLabel} htmlFor="paste">Assignment text (optional)</Label>
            <Textarea
              className={dsTextarea}
              id="paste"
              value={paste}
              onChange={(e) => onPasteChange(e.target.value)}
              rows={8}
              placeholder="Optional — only if you want to add text alongside your files."
            />
          </div>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-[16px] leading-[1.6] text-ds-ink">
        <input
          type="checkbox"
          className="mt-[6px] h-4 w-4 accent-[#c4785a]"
          checked={rightsOk}
          onChange={(e) => onRightsOkChange(e.target.checked)}
        />
        <span>I&apos;m uploading this for my own coursework.</span>
      </label>

      <p className="text-[13px] leading-[1.6] text-ds-muted">
        We keep these files while this paper is on your account, and for 90 days
        after it&apos;s deleted. You can remove a file anytime.
      </p>

      {error ? (
        <p className="text-[16px] leading-[1.6] text-ds-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
