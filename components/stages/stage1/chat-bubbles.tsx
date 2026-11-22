"use client";

import type { ReactNode } from "react";
import { PauPauAvatar } from "@/components/stages/stage1/pau-pau-confirm";
import { COACH_NAME } from "@/lib/stage1/pau-pau";
import { cn } from "@/lib/utils";

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
  /** The opening question is the screen's heading. */
  as?: "p" | "h1" | "div";
  /** After the name: "your writing coach", "Getting to know you", … */
  label?: string;
  className?: string;
}) {
  const Tag = as;
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)}>
      <PauPauAvatar />
      <div className="min-w-0 flex-1">
        {showName ? (
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ds-muted">
            {COACH_NAME} <span className="font-normal normal-case tracking-normal">· {label}</span>
          </p>
        ) : null}
        <div
          className="mt-2 inline-block max-w-full rounded-[12px] rounded-tl-[4px] border border-ds-border bg-ds-surface px-4 py-3 shadow-ds-card sm:px-5 sm:py-4"
          aria-live={live ? "polite" : undefined}
        >
          <Tag id={id} className="font-ds-sans text-[18px] font-normal leading-[1.6] text-ds-ink">
            {children}
          </Tag>
        </div>
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

/** Pau Pau is reading: three quiet dots (still under reduced motion) plus the status line. */
export function ReadingBubble({ status, seconds }: { status: string; seconds: number }) {
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
          {seconds > 0 ? `Still reading… ${seconds}s. ` : ""}
          {COACH_NAME} is only reading what the assignment says. Questions come after.
        </p>
      </div>
    </div>
  );
}

const SENT_KEY = (paperId: string) => `rw:sent:${paperId}`;

export function saveSentMessage(paperId: string, message: SentMessage) {
  try {
    window.localStorage.setItem(
      SENT_KEY(paperId),
      JSON.stringify({ ...message, text: message.text.slice(0, 4000), files: message.files.slice(0, 10) }),
    );
  } catch {
    /* private mode */
  }
}

export function readSentMessage(paperId: string): SentMessage | null {
  try {
    const raw = window.localStorage.getItem(SENT_KEY(paperId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SentMessage;
    return typeof parsed?.text === "string" && Array.isArray(parsed.files) ? parsed : null;
  } catch {
    return null;
  }
}
