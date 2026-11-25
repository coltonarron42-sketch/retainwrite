"use client";

// PC-28 (Colton t185u): "Past chat" opens the full earlier conversation, read-only.
// PC-30: The Skeleton is its own full-screen view (components/skeleton/skeleton-dock.tsx).
import { useEffect, useState, type ReactNode } from "react";

export type PastLine = { who: "pau" | "you" | "pick"; text: string; heading?: string | null };

function Overlay({ label, onClose, children, side = false, data }: { label: string; onClose: () => void; children: ReactNode; side?: boolean; data: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={side ? "fixed inset-0 z-50 md:pointer-events-none" : "fixed inset-0 z-50"}>
      <button
        type="button"
        aria-label={`Close ${label}`}
        className={side ? "absolute inset-0 bg-black/30 md:hidden" : "absolute inset-0 bg-black/30"}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal={side ? undefined : true}
        aria-label={label}
        {...{ [data]: "" }}
        className={
          side
            ? "pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-[16px] border border-ds-border bg-ds-surface shadow-ds-card md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[380px] md:rounded-none md:border-y-0 md:border-r-0"
            : "absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-[16px] border border-ds-border bg-ds-surface shadow-ds-card md:inset-x-auto md:left-1/2 md:top-[8vh] md:bottom-auto md:max-h-[84vh] md:w-[680px] md:-translate-x-1/2 md:rounded-[12px]"
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-ds-border px-5 py-3">
          <h2 className="font-display text-[18px] font-semibold text-ds-ink">{label}</h2>
          <button type="button" className="ds-focus rounded px-2 py-1 text-[14px] font-semibold text-ds-ink underline underline-offset-4" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </section>
    </div>
  );
}

/** Her saved lines from before the rename (Colton t187u: she's just "Pau"). */
export function coachNameNow(text: string): string {
  return text.replace(/\bPau Pau\b/g, "Pau").replace(/\bPAU PAU\b/g, "PAU");
}

/** QA 3:26 AM #5: Stage 1 saves what was actually on screen under this key (never a stage1:* answer key). */
export const STAGE1_PAST_KEY = "past_chat:stage1";

export function parsePastLines(text: string | null | undefined): PastLine[] {
  if (!text) return [];
  try {
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l): l is PastLine => Boolean(l) && typeof (l as PastLine).text === "string" && ["pau", "you", "pick"].includes(String((l as PastLine).who)))
      .map((l) => ({ who: l.who, text: l.text, heading: l.heading ?? null }));
  } catch {
    return [];
  }
}

/**
 * Saved lines first, then any live line not saved yet, slotted in after the live line
 * before it, so a reload (which forgets the in-page asides) never drops what was said.
 */
export function mergePast(saved: PastLine[], live: PastLine[]): PastLine[] {
  const key = (l: PastLine) => `${l.who}|${l.text.trim()}`;
  const out = saved.map((l) => ({ ...l }));
  let at = -1;
  for (const l of live) {
    const found = out.findIndex((x, i) => i > at && key(x) === key(l));
    if (found >= 0) {
      at = found;
      continue;
    }
    const any = out.findIndex((x) => key(x) === key(l));
    if (any >= 0) continue;
    out.splice(at + 1, 0, { ...l });
    at += 1;
  }
  return out;
}

/**
 * QA 1:11 AM #6 / 3:26 AM #5: Past chat carries Stage 1 too, rebuilt from the turns Stage 1
 * saved (her actual replies, asides, catch-up and re-asks). Older papers fall back to the
 * saved answers, without inventing a question she never asked. Nothing in demo mode.
 */
export function useStage1Past(paperId: string | null | undefined, enabled = true): PastLine[] {
  const [lines, setLines] = useState<PastLine[]>([]);
  useEffect(() => {
    if (!paperId || !enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const saved = await fetch(`/api/papers/${paperId}/autosave`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        const row = (saved?.drafts as { fieldKey?: string; text?: string }[] | undefined)?.find((d) => d.fieldKey === STAGE1_PAST_KEY);
        const past = parsePastLines(row?.text);
        if (past.length) {
          if (!cancelled) setLines(withHeading(past));
          return;
        }
        const data = await fetch(`/api/papers/${paperId}/intake/answers`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { answers: [] }));
        if (!cancelled) setLines(stage1PastLines((data as { answers?: Stage1Answer[] }).answers ?? []));
      } catch {
        /* Past chat just shows less */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paperId, enabled]);
  return lines;
}

function withHeading(lines: PastLine[]): PastLine[] {
  return lines.map((l, i) => ({ ...l, heading: i === 0 ? "Stage 1 · Getting started" : null }));
}

type Stage1Answer = { questionId?: string | null; question_id?: string | null; questionText?: string | null; answerText?: string | null; question_text?: string | null; answer_text?: string | null };
export function stage1PastLines(answers: Stage1Answer[]): PastLine[] {
  const out: PastLine[] = [];
  for (const a of answers) {
    const id = a.questionId ?? a.question_id ?? "";
    // The early take's stored label was never asked word for word: show their words only.
    const q = id === "stance_early" ? "" : (a.questionText ?? a.question_text ?? "").trim();
    const t = (a.answerText ?? a.answer_text ?? "").trim();
    if (!t) continue;
    if (q) out.push({ who: "pau", text: q, heading: out.length ? null : "Stage 1 · Getting started" });
    out.push({ who: "you", text: t, heading: out.length ? null : "Stage 1 · Getting started" });
  }
  return out;
}

/** Earlier stages first, each with its own heading (never merged into the current stage's first section). */
export function withEarlier(earlier: PastLine[], current: PastLine[], currentHeading: string): PastLine[] {
  if (!earlier.length) return current;
  return [...earlier, ...current.map((l, i) => (i === 0 ? { ...l, heading: l.heading ? `${currentHeading} · ${l.heading}` : currentHeading } : l))];
}

/** The full earlier conversation, read-only. */
export function PastChatPanel({ lines, onClose }: { lines: PastLine[]; onClose: () => void }) {
  return (
    <Overlay label="Past chat" onClose={onClose} data="data-past-chat">
      {lines.length ? (
        <ol className="space-y-3" aria-label="Earlier conversation, read-only">
          {lines.map((l, i) => (
            <li key={i}>
              {l.heading ? <p className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-ds-muted">{l.heading}</p> : null}
              <p
                className={
                  l.who === "pau"
                    ? "text-[15px] leading-[1.6] text-ds-ink"
                    : "ml-8 rounded-[10px] bg-ds-page px-3 py-2 text-[15px] leading-[1.6] text-ds-ink"
                }
              >
                <span className="sr-only">{l.who === "pau" ? "Pau: " : "You: "}</span>
                {l.who === "pick" ? `Picked: ${l.text.replace(/^\s*picked:\s*/i, "")}` : l.who === "pau" ? coachNameNow(l.text) : l.text}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[15px] text-ds-muted">Nothing here yet.</p>
      )}
    </Overlay>
  );
}

// PC-30: the skeleton is now The Skeleton (components/skeleton/skeleton-dock.tsx), opened from
// the tab on the right edge; its helpers live in lib/skeleton/sections.ts.
export { shortDirection, wordsForBlock, type SkeletonWords } from "@/lib/skeleton/sections";

/** PC-30: The Skeleton opens from the tab on the right edge (not a button here). */
export function FocusBar({ onPast, hasPast, menu }: { onSkeleton?: () => void; onPast: () => void; hasPast: boolean; menu?: ReactNode }) {
  if (!hasPast && !menu) return null;
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2" data-focus-bar>
      {hasPast ? (
        <button type="button" className="ds-focus rounded-full border border-ds-border px-3 py-1 text-[13px] font-semibold text-ds-ink" data-past-chat-open onClick={onPast}>
          Past chat
        </button>
      ) : null}
      {menu ? (
        // PC-28: the section tools (edit assignment, prompt type, sections) stay one tap away after a return.
        <details className="w-full sm:w-auto" data-section-tools>
          <summary className="ds-focus inline-block cursor-pointer rounded-full border border-ds-border px-3 py-1 text-[13px] font-semibold text-ds-ink">
            Section tools
          </summary>
          <div className="mt-2 rounded-ds border border-ds-border bg-ds-surface p-3">{menu}</div>
        </details>
      ) : null}
    </div>
  );
}
