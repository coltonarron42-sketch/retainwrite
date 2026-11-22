"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { COACH_NAME } from "@/lib/stage1/pau-pau";
import { cn } from "@/lib/utils";

/** Small round mark for the coach; Design System colors only. */
export function PauPauAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={
        size === "sm"
          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ds-ink font-ds-sans text-[10px] font-semibold text-white"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-ink font-ds-sans text-[13px] font-semibold tracking-wide text-white sm:h-10 sm:w-10"
      }
    >
      PP
    </span>
  );
}

const BUBBLE =
  "inline-block max-w-full rounded-[12px] rounded-tl-[4px] border border-ds-border bg-ds-surface px-4 py-3 shadow-ds-card sm:px-5 sm:py-4";

/** Pau Pau's side of the chat: avatar, name on the first bubble, white card bubble. */
export function PauPauBubble({
  children,
  id,
  showName = true,
  live = false,
  as = "p",
  label = "your writing coach",
  className,
}: {
  children: ReactNode;
  id?: string;
  showName?: boolean;
  live?: boolean;
  /** The current question is the screen's heading. */
  as?: "p" | "h1" | "div";
  label?: string;
  className?: string;
}) {
  const Tag = as;
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)}>
      <PauPauAvatar />
      <div className="min-w-0 flex-1">
        {showName ? (
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ds-muted">
            {COACH_NAME} <span className="font-normal normal-case tracking-normal">· {label}</span>
          </p>
        ) : null}
        <div className={BUBBLE} aria-live={live ? "polite" : undefined}>
          <Tag id={id} className="font-ds-sans text-[18px] font-normal leading-[1.6] text-ds-ink">
            {children}
          </Tag>
        </div>
      </div>
    </div>
  );
}

/**
 * Several short Pau Pau messages in a row: one avatar, one idea per bubble.
 * Items can be strings or rich content (buttons inside a bubble).
 */
export function PauPauGroup({
  bubbles,
  showName = false,
  label = "your writing coach",
  headingIndex,
  headingId,
  live = false,
  children,
}: {
  bubbles: ReactNode[];
  showName?: boolean;
  label?: string;
  /** Which bubble is the screen's heading (the current question). */
  headingIndex?: number;
  headingId?: string;
  live?: boolean;
  /** Extra content under the bubbles (buttons, captions), in Pau Pau's column. */
  children?: ReactNode;
}) {
  const shown = bubbles.filter((b) => b !== null && b !== undefined && b !== "");
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <PauPauAvatar />
      <div className="min-w-0 flex-1 space-y-2" aria-live={live ? "polite" : undefined}>
        {showName ? (
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ds-muted">
            {COACH_NAME} <span className="font-normal normal-case tracking-normal">· {label}</span>
          </p>
        ) : null}
        {shown.map((bubble, i) => {
          const Tag = i === headingIndex ? "h1" : typeof bubble === "string" ? "p" : "div";
          return (
            <div key={i}>
              <div className={BUBBLE}>
                <Tag
                  id={i === headingIndex ? headingId : undefined}
                  className="font-ds-sans text-[18px] font-normal leading-[1.6] text-ds-ink"
                >
                  {bubble}
                </Tag>
              </div>
            </div>
          );
        })}
        {children}
      </div>
    </div>
  );
}

export type SentAttachment = { name: string; kind?: string };
export type SentMessage = { text: string; files: SentAttachment[]; at: number };

/** The student's side: right-aligned, warm page tone, their own words verbatim. */
export function StudentBubble({ message }: { message: SentMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[12px] rounded-tr-[4px] bg-ds-border px-4 py-3">
        <p className="sr-only">You sent:</p>
        {message.files.length ? (
          <ul className="flex flex-wrap justify-end gap-2" aria-label="Attached files">
            {message.files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="max-w-[220px] truncate rounded-[8px] border border-ds-border bg-ds-surface px-2 py-1 text-[13px] font-semibold text-ds-ink"
              >
                {f.name}
              </li>
            ))}
          </ul>
        ) : null}
        {message.text ? (
          <p className={cn("whitespace-pre-wrap break-words text-[16px] leading-[1.6] text-ds-ink", message.files.length && "mt-2")}>
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The student's earlier answer, echoed in the thread. Tapping it (or its Edit
 * link) reopens that question with the answer in the box.
 */
export function EchoBubble({
  text,
  onEdit,
  editLabel,
  editing = false,
  muted = false,
}: {
  text: string;
  onEdit?: () => void;
  /** Screen-reader name for the edit action, e.g. "Edit your answer: What topics…". */
  editLabel?: string;
  editing?: boolean;
  muted?: boolean;
}) {
  const body = (
    <>
      <span className="sr-only">You said: </span>
      <span
        className={cn(
          "block whitespace-pre-wrap break-words text-left text-[16px] leading-[1.6]",
          muted ? "italic text-ds-muted" : "text-ds-ink",
        )}
      >
        {text}
      </span>
    </>
  );
  return (
    <div className="flex flex-col items-end">
      {onEdit && !editing ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="ds-focus max-w-[85%] rounded-[12px] rounded-tr-[4px] bg-ds-border px-4 py-3 transition-colors duration-150 hover:brightness-[0.97]"
        >
          {body}
        </button>
      ) : (
        <div
          className={cn(
            "max-w-[85%] rounded-[12px] rounded-tr-[4px] bg-ds-border px-4 py-3",
            editing && "ring-2 ring-ds-accent ring-offset-2 ring-offset-ds-page",
          )}
        >
          {body}
        </div>
      )}
      {onEdit && !editing ? (
        <button
          type="button"
          onClick={onEdit}
          tabIndex={-1}
          aria-hidden
          className="min-h-[32px] px-2 text-[13px] font-semibold text-ds-muted underline-offset-4 hover:underline"
        >
          Edit
        </button>
      ) : editing ? (
        <p className="px-2 pt-1 text-[13px] text-ds-muted">Editing below</p>
      ) : null}
    </div>
  );
}

/** Seconds since `startedAt`, ticking every second while mounted. */
function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** Pau Pau is reading: three quiet dots (still under reduced motion) plus the status line. */
export function ReadingBubble({ status, startedAt }: { status: string; startedAt: number }) {
  const seconds = useElapsed(startedAt);
  return (
    <div className="flex items-start gap-2 sm:gap-3" role="status">
      <PauPauAvatar />
      <div className="mt-1 rounded-[12px] rounded-tl-[4px] border border-ds-border bg-ds-surface px-4 py-3 shadow-ds-card">
        <p className="flex items-center gap-2 text-[16px] leading-[1.6] text-ds-ink">
          <span aria-hidden className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-ds-faint motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </span>
          <span>{status}</span>
        </p>
        <p className="mt-1 text-[13px] leading-[1.6] text-ds-muted">
          <span aria-hidden={seconds % 5 !== 0 || undefined}>{seconds > 0 ? `Still reading… ${seconds}s. ` : ""}</span>
          {COACH_NAME} is only reading what the assignment says. Questions come after.
        </p>
      </div>
    </div>
  );
}

/**
 * Keeps the newest message in view: scrolls the end of the thread into view
 * whenever `signal` changes (a new bubble, a new question, an error).
 */
export function ScrollToNewest({ signal }: { signal: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = first.current || reduce ? "auto" : "smooth";
    first.current = false;
    // After layout, so the new bubble has its height.
    const id = window.requestAnimationFrame(() => el.scrollIntoView({ block: "end", behavior }));
    return () => window.cancelAnimationFrame(id);
  }, [signal]);
  return <div ref={ref} aria-hidden className="h-px scroll-mb-4" />;
}

/**
 * The composer stays at the bottom of the screen while the thread scrolls, and
 * above the on-screen keyboard: iOS keeps the layout viewport full height when
 * the keyboard opens, so lift the dock by the part of the screen it covers.
 */
export function ComposerDock({ children }: { children: ReactNode }) {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setLift(covered > 60 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <div
      data-composer-dock
      className="sticky z-10 -mx-4 bg-ds-page/95 px-4 pb-3 pt-3 backdrop-blur-sm sm:mx-0 sm:px-0"
      style={{ bottom: lift }}
    >
      {children}
    </div>
  );
}

const SENT_KEY = (paperId: string) => `rw:sent:${paperId}`;
/** The same message on the server (autosave row), so another device rebuilds the thread. */
export const SENT_FIELD_KEY = "intake:sent";

export function saveSentMessage(paperId: string, message: SentMessage) {
  try {
    window.localStorage.setItem(SENT_KEY(paperId), JSON.stringify(trimSent(message)));
  } catch {
    /* private mode */
  }
}

export function trimSent(message: SentMessage): SentMessage {
  return { ...message, text: message.text.slice(0, 4000), files: message.files.slice(0, 10) };
}

export function parseSentMessage(raw: string | null | undefined): SentMessage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SentMessage;
    return typeof parsed?.text === "string" && Array.isArray(parsed.files) ? parsed : null;
  } catch {
    return null;
  }
}

export function readSentMessage(paperId: string): SentMessage | null {
  try {
    return parseSentMessage(window.localStorage.getItem(SENT_KEY(paperId)));
  } catch {
    return null;
  }
}

/** First few words of a longer label, for compact chips. */
export function shortLabel(text: string, maxWords = 6): string {
  const words = text.trim().replace(/[?.!]+$/, "").split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? words.join(" ") : `${words.slice(0, maxWords).join(" ")}…`;
}

/**
 * Neutral record of a choice the student tapped, e.g. a suggested story
 * angle. Not a speech bubble: the app never writes the student's words.
 */
export function PickedChip({
  label,
  fullText,
  onEdit,
  editLabel,
}: {
  label: string;
  fullText: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const body = (
    <>
      <span className="text-ds-muted">Picked:</span> <span className="text-ds-ink">{label}</span>
      <span className="sr-only"> ({fullText})</span>
    </>
  );
  const cls =
    "inline-flex min-h-[48px] max-w-[85%] items-center gap-1 rounded-full border border-ds-border bg-ds-surface px-4 py-2 text-left text-[14px] leading-[1.4]";
  return (
    <div className="flex justify-end" data-picked-chip>
      {onEdit ? (
        <button type="button" onClick={onEdit} aria-label={`${editLabel ?? "Change"}: picked ${fullText}`} className={cn("ds-focus transition-colors duration-150 hover:brightness-[0.97]", cls)}>
          {body}
        </button>
      ) : (
        <p className={cls}>{body}</p>
      )}
    </div>
  );
}
