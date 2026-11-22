"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowUp, Camera, FileText, Images, Mic, Plus, Square, X } from "lucide-react";
import { CameraCapture } from "@/components/stages/stage1/camera-capture";
import {
  extractStagedFile,
  type StagedAssignmentFile,
} from "@/components/stages/stage1/upload-panel";
import { KIND_LABEL } from "@/lib/assignment/client-extract";
import { ACCEPTED_TYPES_SENTENCE, ASSIGNMENT_ACCEPT, kindFromName } from "@/lib/assignment/file-types";
import { assertUploadBatch, guessMimeFromFilename } from "@/lib/assignment/upload-limits";
import { ASSIGNMENT_MAX_FILES } from "@/lib/config";
import { cn } from "@/lib/utils";

const PHOTO_ACCEPT = "image/*,.heic,.heif";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type MenuKey = "gallery" | "files" | "camera";
const MENU = [
  ["gallery", "From camera roll", Images],
  ["files", "From files", FileText],
  ["camera", "Use camera", Camera],
] as const;

function newId() {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

/** One state per chip: reading, read, or couldn't read. */
function chipStatus(f: StagedAssignmentFile): string {
  if (f.status === "reading") return f.kind === "photo" ? "Reading… up to 30s" : "Reading…";
  if (f.status === "failed") return "Couldn't read";
  const words = f.extractedText.split(/\s+/).filter(Boolean).length;
  return `Read · ${words} words`;
}

export type ChatComposerProps = {
  paperId: string;
  /** The Pau Pau bubble that asks the question labels the field. */
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  sendLabel?: string;
  sending?: boolean;
  /** Extra reason Send is off (beyond empty, reading, or failed files). */
  sendBlocked?: boolean;
  /** Attachments: omit to show a text-only box (later questions). */
  files?: StagedAssignmentFile[];
  onFilesChange?: Dispatch<SetStateAction<StagedAssignmentFile[]>>;
  onRetryFile?: (id: string) => void;
  onError?: (message: string | null) => void;
  /** Paste and typing counts for the coaching answer (optional). */
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  inputProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  minRows?: number;
  /** Desktop Enter sends (Shift+Enter for a new line). Off for paragraph answers. */
  enterSends?: boolean;
};

/**
 * Chat-style input: one text field, + for attachments (camera roll, files, or
 * the camera), a mic that types the student's own spoken words into the field
 * (never sends), and Send. Send stays off while files are reading or failed.
 */
export function ChatComposer({
  paperId,
  labelledBy,
  value,
  onChange,
  onSend,
  placeholder,
  sendLabel = "Send",
  sending = false,
  sendBlocked = false,
  files,
  onFilesChange,
  onRetryFile,
  onError,
  onPaste,
  inputProps,
  minRows = 2,
  enterSends = true,
}: ChatComposerProps) {
  const menuId = useId();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [canDictate, setCanDictate] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const attachments = useMemo(() => files ?? [], [files]);
  const reading = attachments.some((f) => f.status === "reading");
  const failed = attachments.some((f) => f.status === "failed");
  const hasContent = Boolean(value.trim()) || attachments.length > 0;
  const sendDisabled = !hasContent || reading || failed || sending || sendBlocked;

  useEffect(() => setCanDictate(Boolean(speechRecognition())), []);
  useEffect(() => () => recRef.current?.abort(), []);

  // Grow with the text, up to about eight lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [value]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") {
          setMenuOpen(false);
          plusRef.current?.focus();
        }
        return;
      }
      const target = e.target as Node;
      if (!document.getElementById(menuId)?.contains(target) && !plusRef.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen, menuId]);

  const ingestFiles = useCallback(
    async (list: FileList | File[]) => {
      if (!onFilesChange) return;
      onError?.(null);
      const incoming = Array.from(list);
      if (!incoming.length) return;
      const check = assertUploadBatch(
        attachments.map((f) => ({ filename: f.filename, mime: f.mime, byteSize: f.byteSize })),
        incoming.map((f) => ({
          filename: f.name,
          mime: f.type || guessMimeFromFilename(f.name) || "application/octet-stream",
          byteSize: f.size,
        })),
      );
      if (!check.ok) {
        onError?.(check.reason);
        return;
      }
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
          kind: kindFromName(file.name) === "unknown" && mime.startsWith("image/") ? "photo" : kindFromName(file.name),
          method: "manual",
        };
      });
      onFilesChange((prev) => [...prev, ...staged]);
      await Promise.all(staged.map((item) => extractStagedFile(paperId, item.id, item.file, onFilesChange)));
    },
    [attachments, onError, onFilesChange, paperId],
  );

  function removeFile(id: string) {
    if (!onFilesChange) return;
    const removed = attachments.find((f) => f.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onFilesChange((prev) => prev.filter((f) => f.id !== id));
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  function toggleMic() {
    if (listening) return stopListening();
    const Rec = speechRecognition();
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = valueRef.current.replace(/\s+$/, "");
    let finalText = "";
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]!;
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      const spoken = `${finalText}${interim}`.replace(/\s+/g, " ").trim();
      onChange([baseRef.current, spoken].filter(Boolean).join(" "));
    };
    rec.onerror = (event) => {
      setMicNote(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "The microphone is blocked. Allow it in your browser settings, or type instead."
          : event.error === "no-speech"
            ? "I didn't hear anything. Tap the mic and try again."
            : "Voice typing stopped. You can tap the mic again or type instead.",
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    setMicNote(null);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function pick(key: MenuKey) {
    setMenuOpen(false);
    if (key === "gallery") galleryRef.current?.click();
    else if (key === "files") fileRef.current?.click();
    else setCameraOpen(true);
  }

  function send() {
    if (sendDisabled) return;
    if (listening) stopListening();
    onSend();
  }

  const failedFile = attachments.find((f) => f.status === "failed");

  return (
    <div className="relative">
      <div
        className={cn(
          "rounded-[12px] border bg-ds-surface shadow-ds-card transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ds-accent focus-within:ring-offset-2",
          dragging ? "border-ds-accent" : "border-ds-border",
        )}
        onDragEnter={(e) => {
          if (!onFilesChange) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!onFilesChange) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!onFilesChange) return;
          e.preventDefault();
          setDragging(false);
          void ingestFiles(e.dataTransfer.files);
        }}
      >
        {attachments.length ? (
          <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Attached files">
            {attachments.map((f) => (
              <li
                key={f.id}
                className={cn(
                  "flex max-w-full items-center gap-2 rounded-[8px] border bg-ds-page py-1 pl-1 pr-1",
                  f.status === "failed" ? "border-ds-error" : "border-ds-border",
                )}
              >
                {f.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-[4px] object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-ds-surface text-[10px] font-semibold uppercase text-ds-muted">
                    {f.filename.split(".").pop()?.slice(0, 4) || "file"}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block max-w-[150px] truncate text-[13px] font-semibold leading-[1.3] text-ds-ink sm:max-w-[220px]">
                    {f.filename}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[13px] leading-[1.3]",
                      f.status === "failed" ? "text-ds-error" : "text-ds-muted",
                    )}
                    role="status"
                  >
                    {f.status === "reading" ? (
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-ds-border border-t-ds-accent motion-safe:animate-spin"
                      />
                    ) : null}
                    {chipStatus(f)}
                  </span>
                </span>
                {f.status === "failed" && onRetryFile ? (
                  <button
                    type="button"
                    className="ds-focus min-h-[32px] rounded-[4px] px-2 text-[13px] font-semibold text-ds-ink underline underline-offset-4"
                    onClick={() => onRetryFile(f.id)}
                  >
                    Retry
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${f.filename}`}
                  className="ds-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-ds-muted hover:text-ds-ink"
                  onClick={() => removeFile(f.id)}
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <textarea
          ref={taRef}
          aria-labelledby={labelledBy}
          rows={minRows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            // Desktop: Enter sends, Shift+Enter is a new line. Phones keep Enter for new lines.
            if (enterSends && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              send();
            }
          }}
          className="block w-full resize-none border-0 bg-transparent px-4 pt-3 text-[16px] leading-[1.6] text-ds-ink placeholder:text-ds-faint focus:outline-none focus:ring-0"
          {...inputProps}
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
          <div className="flex items-center gap-1">
            {onFilesChange ? (
              <button
                ref={plusRef}
                type="button"
                aria-label="Add a photo or file"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? menuId : undefined}
                className="ds-focus flex h-11 w-11 items-center justify-center rounded-full text-ds-ink transition-colors duration-150 hover:bg-ds-page"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Plus aria-hidden className="h-5 w-5" />
              </button>
            ) : null}
            {canDictate ? (
              <button
                type="button"
                aria-label={listening ? "Stop voice typing" : "Voice typing: speak and it types into the box"}
                aria-pressed={listening}
                className={cn(
                  "ds-focus flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150",
                  listening ? "bg-ds-ink text-white" : "text-ds-ink hover:bg-ds-page",
                )}
                onClick={toggleMic}
              >
                {listening ? <Square aria-hidden className="h-4 w-4" /> : <Mic aria-hidden className="h-5 w-5" />}
              </button>
            ) : null}
            {listening ? <span className="text-[13px] text-ds-muted" role="status">Listening…</span> : null}
          </div>
          <button
            type="button"
            aria-label={sendLabel}
            disabled={sendDisabled}
            aria-busy={sending || reading || undefined}
            className="ds-focus flex h-11 w-11 items-center justify-center rounded-full bg-ds-accent text-white shadow-ds-button transition-colors duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:bg-ds-border disabled:text-ds-muted disabled:shadow-none"
            onClick={send}
          >
            <ArrowUp aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Add a photo or file"
          className="absolute bottom-full left-0 z-20 mb-2 w-[min(300px,100%)] rounded-[12px] border border-ds-border bg-ds-surface p-2 shadow-ds-card"
        >
          {MENU.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className="ds-focus flex min-h-[48px] w-full items-center gap-3 rounded-[8px] px-3 text-left text-[16px] font-semibold text-ds-ink hover:bg-ds-page"
              onClick={() => pick(key)}
            >
              <Icon aria-hidden className="h-5 w-5 text-ds-muted" />
              {label}
            </button>
          ))}
          <p className="px-3 pb-1 pt-2 text-[13px] leading-[1.6] text-ds-muted">
            {ACCEPTED_TYPES_SENTENCE} — up to {ASSIGNMENT_MAX_FILES} files, 25 MB each.
          </p>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="mt-4">
          <CameraCapture
            onCapture={(file) => void ingestFiles([file])}
            onUseSystemCamera={() => cameraRef.current?.click()}
            onClose={() => setCameraOpen(false)}
          />
        </div>
      ) : null}

      {onFilesChange ? (
        <>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label="Attach files"
            accept={ASSIGNMENT_ACCEPT}
            multiple
            onChange={(e) => {
              if (e.target.files) void ingestFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label="Attach photos"
            accept={PHOTO_ACCEPT}
            multiple
            onChange={(e) => {
              if (e.target.files) void ingestFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label="Take a photo"
            accept={PHOTO_ACCEPT}
            capture="environment"
            onChange={(e) => {
              if (e.target.files) void ingestFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </>
      ) : null}

      {failedFile ? (
        <p className="mt-2 text-[16px] leading-[1.6] text-ds-error" role="alert">
          {failedFile.error ?? `I couldn't read ${failedFile.filename}.`} Retry it or remove it to send.
        </p>
      ) : reading ? (
        <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted">
          Reading your {attachments.length === 1 ? KIND_LABEL[attachments[0]!.kind ?? "unknown"] : "files"}… Send unlocks when it&apos;s done.
        </p>
      ) : null}
      {micNote ? (
        <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted" role="status">
          {micNote}
        </p>
      ) : null}
    </div>
  );
}
