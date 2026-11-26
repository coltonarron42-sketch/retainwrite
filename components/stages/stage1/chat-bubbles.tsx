"use client";

import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { COACH_NAME } from "@/lib/stage1/pau-pau";
import { friendlyStatus, isAssignmentRead } from "@/lib/stage1/reading-status";
import { cn } from "@/lib/utils";
import { tidyPunct } from "@/lib/copy/tidy";
import { parseSourcesLine } from "@/lib/coach/sources-line";
import { plainText } from "@/lib/voice/presence";
import { PauFace, SpeakingWaves, useBubbleSpeaking } from "@/components/stages/stage1/pau-presence";

/** Small round mark for the coach: a flat face, Design System colors only. */
export function PauPauAvatar({ size = "md", alive = false }: { size?: "sm" | "md"; alive?: boolean }) {
  return (
    <span aria-hidden data-pau-avatar className={size === "sm" ? "flex h-6 w-6 shrink-0" : "flex h-8 w-8 shrink-0 sm:h-10 sm:w-10"}>
      <PauFace alive={alive} className="h-full w-full" />
    </span>
  );
}

// PLAN.md 9 (Nov 22, 2:43): Pau's turns read as plain text beside her
// avatar: no card border, shadow or box.
const BUBBLE = "inline-block max-w-full pt-1";
// The student's turns: a light right-aligned block with a thin rule.
const STUDENT = "max-w-[85%] border-r-2 border-ds-border py-1 pr-3 text-right";

/** Pau's side of the chat: avatar, name on the first turn, plain text (no box). */
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
  const speaking = useBubbleSpeaking(plainText([children].flat()));
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)} data-chat-line="pau">
      <PauPauAvatar alive={speaking} />
      <div className="min-w-0 flex-1">
        {showName ? (
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ds-muted" data-chat-name>
            {COACH_NAME} <span className="font-normal normal-case tracking-normal">· {label}</span>
          </p>
        ) : null}
        {/* Waves sit outside the bubble box: absolutely placed, no layout shift. */}
        <div className="relative w-fit max-w-full" data-pau-speaking={speaking || undefined}>
          <SpeakingWaves active={speaking} />
          <div className={BUBBLE} aria-live={live ? "polite" : undefined}>
            <Tag id={id} className="font-ds-sans text-[18px] font-normal leading-[1.6] text-ds-ink">
              {typeof children === "string" ? tidyPunct(children) : children}
            </Tag>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One Pau turn: a single message block, like one chat reply. Items are
 * paragraphs inside the same bubble (strings or rich content such as a list
 * of choices); `children` (buttons, captions) sit in the same bubble too.
 * PLAN.md 9: one reply per turn, never stacked bubbles saying one thing.
 */
export function PauPauGroup({
  bubbles,
  showName = false,
  label = "your writing coach",
  headingIndex,
  headingId,
  live = false,
  children,
  className,
}: {
  bubbles: ReactNode[];
  showName?: boolean;
  label?: string;
  /** Which paragraph is the screen's heading (the current question). */
  headingIndex?: number;
  headingId?: string;
  live?: boolean;
  /** Extra content at the end of the same reply (buttons, captions). */
  children?: ReactNode;
  className?: string;
}) {
  const shown = bubbles
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b !== null && b !== undefined && b !== "" && b !== false)
    .map(({ b, i }) => ({ b: typeof b === "string" ? (parseSourcesLine(b) ? <SourcesLinks line={b} /> : tidyPunct(b)) : b, i }));
  const speaking = useBubbleSpeaking(plainText(shown.map(({ b }) => b)));
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)} data-pau-turn data-chat-line="pau">
      <PauPauAvatar alive={speaking} />
      <div className="min-w-0 flex-1">
        {showName ? (
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ds-muted" data-chat-name>
            {COACH_NAME} <span className="font-normal normal-case tracking-normal">· {label}</span>
          </p>
        ) : null}
        <div className="relative w-fit max-w-full" data-pau-speaking={speaking || undefined}>
        <SpeakingWaves active={speaking} />
        <div className={cn(BUBBLE, "block w-fit space-y-3")} aria-live={live ? "polite" : undefined}>
          {shown.map(({ b, i }) => {
            const Tag = i === headingIndex ? "h1" : typeof b === "string" ? "p" : "div";
            return (
              <Tag
                key={i}
                id={i === headingIndex ? headingId : undefined}
                className="font-ds-sans text-[18px] font-normal leading-[1.6] text-ds-ink"
              >
                {b}
              </Tag>
            );
          })}
          {children ? <div className="space-y-2">{children}</div> : null}
        </div>
        </div>
      </div>
    </div>
  );
}

/** PC-31 QA 3:46: the one Sources line under a researched reply, with linked titles. */
function SourcesLinks({ line }: { line: string }) {
  const parts = parseSourcesLine(line) ?? [{ text: line }];
  return (
    <span className="text-[15px] text-ds-muted" data-sources-line>
      {parts.map((p, i) =>
        "url" in p ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ds-ink">
            {p.label}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

export type SentAttachment = { name: string; kind?: string };
export type SentMessage = { text: string; files: SentAttachment[]; at: number };

/** The student's side: right-aligned light text block, their own words verbatim. */
export function StudentBubble({ message }: { message: SentMessage }) {
  return (
    <div className="flex justify-end">
      <div className={STUDENT} data-student-turn data-chat-line="you" data-chat-text={message.text || message.files.map((f) => f.name).join(", ")}>
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
  chatText,
  onEdit,
  editLabel,
  editing = false,
  muted = false,
}: {
  text: string;
  /** What Past chat records for this bubble when it differs from what's drawn (earlier sends shown with it were recorded already). */
  chatText?: string;
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
          "block whitespace-pre-wrap break-words text-right text-[16px] leading-[1.6]",
          muted ? "italic text-ds-muted" : "text-ds-ink",
        )}
      >
        {text}
      </span>
    </>
  );
  return (
    <div className="flex flex-col items-end" data-chat-line="you" data-chat-text={chatText ?? text}>
      {onEdit && !editing ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className={cn("ds-focus min-h-[48px] transition-colors duration-150 hover:border-ds-muted", STUDENT)}
        >
          {body}
        </button>
      ) : (
        <div
          className={cn(
            STUDENT,
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

/** Pau is reading: three quiet dots (still under reduced motion) plus the status line. */
export function ReadingBubble({ status, startedAt }: { status: string; startedAt: number }) {
  // QA 3:51 (React #185): callers pass Date.now() on every render. The clock starts once, when the
  // bubble appears; a new prop each render must never restart it (that re-render chain dropped keystrokes).
  const [since] = useState(startedAt);
  const seconds = useElapsed(since);
  return (
    <div className="flex items-start gap-2 sm:gap-3" role="status">
      <PauPauAvatar />
      <div className="mt-1 pt-1">
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
          <span>{friendlyStatus(status)}</span>
        </p>
        {/* PC-29d: the reading footer only while the assignment itself is read, never after a chat send. */}
        {isAssignmentRead(status) ? (
          <p className="mt-1 text-[13px] leading-[1.6] text-ds-muted">
            <span aria-hidden={seconds % 5 !== 0 || undefined}>{seconds > 0 ? `Still reading… ${seconds}s. ` : ""}</span>
            {COACH_NAME} is only reading what the assignment says. Questions come after.
          </p>
        ) : null}
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
  return <div ref={ref} aria-hidden data-scroll-newest className="h-px" style={{ scrollMarginBottom: "calc(var(--rw-dock-h, 0px) + 16px)" }} />;
}

/**
 * The composer stays at the bottom of the screen while the thread scrolls, and
 * above the on-screen keyboard: iOS keeps the layout viewport full height when
 * the keyboard opens, so lift the dock by the part of the screen it covers.
 */
export function ComposerDock({ children }: { children: ReactNode }) {
  const [lift, setLift] = useState(0);
  // Phones: the dock is fixed to the bottom (safe-area aware) and a spacer of
  // the same height keeps the last reply clear of it, so replies, speech and
  // status changes never move it (QA 3:35 A). Wider screens keep it sticky.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  useEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setDockH(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The newest-turn anchor keeps clear of the fixed phone dock (restore and
  // replies land above the composer, never under it).
  useEffect(() => {
    const root = document.documentElement;
    const phone = window.matchMedia?.("(max-width: 639px)").matches ?? false;
    root.style.setProperty("--rw-dock-h", `${phone ? dockH : 0}px`);
    return () => {
      root.style.removeProperty("--rw-dock-h");
    };
  }, [dockH]);
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
    <>
      <div aria-hidden data-composer-spacer className="sm:hidden" style={{ height: dockH }} />
      <div
        ref={dockRef}
        data-composer-dock
        className="fixed inset-x-0 z-20 bg-ds-page/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:sticky sm:inset-x-auto sm:z-10 sm:mx-0 sm:px-0 sm:pb-3"
        style={{ bottom: lift }}
      >
        {children}
      </div>
    </>
  );
}

const SENT_NAME = (paperId: string) => `sent:${paperId}`;
const SENT_LEGACY = (paperId: string) => `rw:sent:${paperId}`;
/** The same message on the server (autosave row), so another device rebuilds the thread. */
export const SENT_FIELD_KEY = "intake:sent";

export function saveSentMessage(paperId: string, message: SentMessage) {
  try {
    writeScoped(SENT_NAME(paperId), JSON.stringify(trimSent(message)));
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
    return parseSentMessage(readScoped(SENT_NAME(paperId), SENT_LEGACY(paperId)));
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
  // QA 1:11 AM minor: one "Picked:" in the page text (the screen-reader copy only when the label is shortened).
  const same = label.trim() === fullText.trim();
  const body = (
    <>
      <span aria-hidden={same ? undefined : true} className="min-w-0 truncate">
        <span className="text-ds-muted">Picked:</span> <span className="text-ds-ink">{label}</span>
      </span>
      {same ? null : <span className="sr-only">{fullText}</span>}
    </>
  );
  const cls =
    "inline-flex min-h-[48px] max-w-[85%] items-center whitespace-nowrap rounded-full border border-ds-border bg-ds-surface px-4 py-2 text-left text-[14px] leading-[1.4]";
  return (
    <div className="flex justify-end" data-picked-chip data-chat-line="pick" data-chat-text={fullText}>
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
