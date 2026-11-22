"use client";

import { joinTranscript } from "@/lib/stage1/transcript";
import {
  SILENCE_INTERIM_MS,
  SILENCE_SEND_MS,
  callOwner,
  callStatusText,
  claimCall,
  releaseCall,
  restartDelayMs,
  subscribeCall,
  type CallStatus,
} from "@/lib/voice/call";
import { useChatPrefs } from "@/lib/voice/prefs";
import { audibleSentence, isSpeaking, speechSupported, stopSpeech, subscribeAudible, subscribeSpeaking, unlockSpeech } from "@/lib/voice/speech";

import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
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
  useEffect(() => {
    if (!micNote) return;
    const t = window.setTimeout(() => setMicNote(null), 6000);
    return () => window.clearTimeout(t);
  }, [micNote]);
  const [canDictate, setCanDictate] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const valueRef = useRef(value);
  // What voice typing last put in the box. If the box changes any other way
  // (typing, Send, the next question, a restored draft) the recognizer is
  // dropped, so a late phrase can't bring back old text.
  const lastEmittedRef = useRef<string | null>(null);
  useEffect(() => {
    valueRef.current = value;
    if (recRef.current && lastEmittedRef.current !== null && value !== lastEmittedRef.current) {
      dropRecognizer();
      stopListening();
    }
  }, [value]);

  const attachments = useMemo(() => files ?? [], [files]);
  const reading = attachments.some((f) => f.status === "reading");
  const failed = attachments.some((f) => f.status === "failed");
  const hasContent = Boolean(value.trim()) || attachments.length > 0;
  const blocked = !hasContent || reading || failed || sendBlocked;
  // Send while Pau Pau is still replying: queue it (visibly) and send when she
  // is done. A send is never dropped (QA 12:25 #4).
  const [queued, setQueued] = useState(false);

  useEffect(() => setCanDictate(Boolean(speechRecognition())), []);
  useEffect(() => () => recRef.current?.abort(), []);

  // Grow with the text, up to about eight lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    // Text put in from outside (a restored draft, voice typing) leaves the
    // caret at the start, so the next thing typed would land in front of it.
    // Keep the caret at the end unless the student is in the box.
    if (document.activeElement !== ta) ta.setSelectionRange(ta.value.length, ta.value.length);
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
    // stop() lets the last phrase finish; dropRecognizer() throws it away.
    recRef.current?.stop();
    setListening(false);
  }

  function dropRecognizer() {
    const rec = recRef.current;
    recRef.current = null;
    lastEmittedRef.current = null;
    rec?.abort();
  }

  function toggleMic() {
    if (listening) return stopListening();
    const Rec = speechRecognition();
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    dropRecognizer();
    baseRef.current = valueRef.current;
    rec.onresult = (event) => {
      if (recRef.current !== rec) return;
      // Rebuild from every result each time. Some Android builds resend old
      // phrases with resultIndex 0, and appending would repeat them.
      const finals: string[] = [];
      const interims: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i]!;
        (r.isFinal ? finals : interims).push(r[0].transcript);
      }
      const next = joinTranscript(baseRef.current, finals, joinTranscript("", interims));
      lastEmittedRef.current = next;
      onChange(next);
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
    rec.onend = () => {
      if (recRef.current === rec) {
        recRef.current = null;
        lastEmittedRef.current = null;
      }
      setListening(false);
    };
    setMicNote(null);
    recRef.current = rec;
    // Pau Pau stops talking while the student talks.
    stopSpeech();
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  /* ---- Voice call: listen between Pau Pau's turns, send after a pause ---- */
  const { voice, micMuted } = useChatPrefs();
  const speaking = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false);
  // "Pau Pau is talking" follows real playback (PLAN.md 9), not the queue.
  const audible = useSyncExternalStore(subscribeAudible, audibleSentence, () => null) !== null;
  const [callId, setCallId] = useState(0);
  const owner = useSyncExternalStore(subscribeCall, callOwner, () => 0);
  const [callTrouble, setCallTrouble] = useState<"blocked" | "error" | null>(null);
  const [callHearing, setCallHearing] = useState(false);
  const callRecRef = useRef<SpeechRecognitionLike | null>(null);
  const callEmittedRef = useRef<string | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartsRef = useRef<number[]>([]);
  const sendRef = useRef<() => void>(() => undefined);
  const wantRef = useRef(false);

  useEffect(() => {
    if (!voice) return;
    const id = claimCall();
    setCallId(id);
    return () => releaseCall(id);
  }, [voice]);

  // A tap on Unmute (prefs change) clears an earlier "blocked"/"error".
  useEffect(() => {
    if (!micMuted) setCallTrouble(null);
  }, [micMuted]);

  const callOn = voice && canDictate;
  const wantListen =
    callOn && !micMuted && !speaking && !sending && !listening && owner === callId && callId !== 0 && !callTrouble;
  const callStatus: CallStatus = !voice
    ? "off"
    : !canDictate
      ? speechSupported()
        ? "unsupported"
        : "off"
      : callTrouble
        ? callTrouble
        : micMuted
          ? "muted"
          : speaking
            ? audible
              ? "paused"
              : "starting"
            : sending
              ? "off"
              : "listening";

  function clearCallTimers() {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    if (restartRef.current) clearTimeout(restartRef.current);
    silenceRef.current = null;
    restartRef.current = null;
  }

  function dropCallRecognizer() {
    const rec = callRecRef.current;
    callRecRef.current = null;
    callEmittedRef.current = null;
    setCallHearing(false);
    rec?.abort();
  }

  function startCallSession() {
    const Rec = speechRecognition();
    if (!Rec) return;
    dropCallRecognizer();
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    const base = valueRef.current;
    rec.onresult = (event) => {
      if (callRecRef.current !== rec) return;
      const finals: string[] = [];
      const interims: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i]!;
        (r.isFinal ? finals : interims).push(r[0].transcript);
      }
      const next = joinTranscript(base, finals, joinTranscript("", interims));
      callEmittedRef.current = next;
      setCallHearing(true);
      onChange(next);
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(
        () => {
          if (callRecRef.current !== rec) return;
          // A short pause after speaking: send it, like talking on a call.
          dropCallRecognizer();
          sendRef.current();
        },
        interims.some((t) => t.trim()) ? SILENCE_INTERIM_MS : SILENCE_SEND_MS,
      );
    };
    rec.onerror = (event) => {
      if (callRecRef.current !== rec) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        dropCallRecognizer();
        setCallTrouble("blocked");
      }
      // "no-speech", "aborted", "network": onend follows and restarts.
    };
    rec.onend = () => {
      if (callRecRef.current !== rec) return;
      // Chrome Android ends sessions after each phrase or a few seconds of quiet.
      callRecRef.current = null;
      setCallHearing(false);
      if (!wantRef.current) return;
      const now = Date.now();
      restartsRef.current = restartsRef.current.filter((t) => now - t < 30_000).concat(now);
      if (restartsRef.current.length > 12) {
        setCallTrouble("error");
        return;
      }
      restartRef.current = setTimeout(() => {
        if (wantRef.current && !callRecRef.current) startCallSession();
      }, restartDelayMs(restartsRef.current.length));
    };
    callRecRef.current = rec;
    try {
      rec.start();
    } catch {
      callRecRef.current = null;
      setCallTrouble("error");
    }
  }

  useEffect(() => {
    wantRef.current = wantListen;
    if (wantListen) {
      if (!callRecRef.current) startCallSession();
    } else {
      clearCallTimers();
      dropCallRecognizer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantListen]);

  // The student typed or the box was cleared: start a fresh session from the new text.
  useEffect(() => {
    if (!callRecRef.current || callEmittedRef.current === null || value === callEmittedRef.current) return;
    clearCallTimers();
    dropCallRecognizer();
    if (wantRef.current) startCallSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(
    () => () => {
      wantRef.current = false;
      clearCallTimers();
      dropCallRecognizer();
    },
    [],
  );

  function pick(key: MenuKey) {
    setMenuOpen(false);
    if (key === "gallery") galleryRef.current?.click();
    else if (key === "files") fileRef.current?.click();
    else setCameraOpen(true);
  }

  function send() {
    if (blocked) return;
    if (sending) {
      setQueued(true);
      return;
    }
    setQueued(false);
    // A tap on Send unlocks speech on phones, so Pau Pau's answer can play.
    unlockSpeech();
    // Barge-in: Send while Pau Pau is talking stops her and takes the reply.
    if (isSpeaking()) stopSpeech();
    // The sent text is final; nothing heard after this goes back in the box.
    dropRecognizer();
    setListening(false);
    clearCallTimers();
    dropCallRecognizer();
    onSend();
  }
  useEffect(() => {
    if (!queued) return;
    if (!value.trim() && attachments.length === 0) {
      setQueued(false);
      return;
    }
    if (!sending) send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, sending, value]);
  useEffect(() => {
    sendRef.current = () => {
      if (!valueRef.current.trim()) return;
      send();
    };
  });

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

        {/* Fixed-height row: status text changes never change the dock's height (QA 3:35 A). */}
        <div className="flex h-[56px] items-center justify-between gap-2 px-2 pb-2 pt-1" data-composer-row>
          <div className="flex min-w-0 items-center gap-1">
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
            {canDictate && !callOn ? (
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
            {callOn || callStatus === "unsupported" ? (
              <span
                className="flex max-h-[40px] min-w-0 items-center gap-2 overflow-hidden px-2 text-[13px] leading-[1.4] text-ds-muted"
                role="status"
                data-call-status={callStatus}
              >
                {callStatus === "listening" ? (
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 shrink-0 rounded-full", callHearing ? "bg-ds-accent" : "bg-ds-sage")}
                  />
                ) : null}
                {callStatusText(callStatus)}
              </span>
            ) : null}
            {callOn && callStatus === "paused" ? (
              // Barge-in: listening stays paused while she talks (echo protection)
              // unless the student taps here; then she stops and the mic opens.
              <button
                type="button"
                data-barge-in
                aria-label="Interrupt Pau Pau and talk"
                className="ds-focus flex min-h-[48px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-ds-ink hover:bg-ds-page"
                onClick={() => {
                  unlockSpeech();
                  stopSpeech();
                }}
              >
                <Mic aria-hidden className="h-4 w-4" />
                Talk now
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={sendLabel}
            disabled={blocked || queued}
            aria-busy={sending || reading || undefined}
            data-send-queued={queued || undefined}
            className="ds-focus flex h-11 w-11 items-center justify-center rounded-full bg-ds-accent text-white shadow-ds-button transition-colors duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:bg-ds-border disabled:text-ds-muted disabled:shadow-none"
            onClick={send}
          >
            <ArrowUp aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>

      {queued ? (
        // Floats just above the box, so it never changes the dock's height.
        <p className="pointer-events-none absolute inset-x-0 bottom-full mb-1 rounded-[8px] bg-ds-page/95 px-2 py-1 text-[13px] leading-[1.5] text-ds-muted" role="status" data-send-queued-note>
          Pau Pau is still replying. Your message sends as soon as she&apos;s done.
        </p>
      ) : null}

      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Add a photo or file"
          className="mt-2 w-full rounded-[12px] border border-ds-border bg-ds-surface p-2 shadow-ds-card sm:w-[320px]"
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
        // A toast above the box (QA 3:35 A): never inside the dock's height.
        <p
          className="absolute inset-x-0 bottom-full mb-1 rounded-[8px] border border-ds-border bg-ds-surface px-3 py-2 text-[13px] leading-[1.5] text-ds-ink shadow-ds-card"
          role="status"
          data-mic-toast
        >
          {micNote}
        </p>
      ) : null}
    </div>
  );
}
