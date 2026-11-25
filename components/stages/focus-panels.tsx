"use client";

// PC-28 (Colton t185u): the focused chat's two side doors. "See skeleton" opens the
// paper's skeleton (a side panel on desktop, a sheet on mobile) without leaving the chat.
// "Past chat" opens the full earlier conversation, read-only. No animation.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SkeletonView } from "@/lib/skeleton/shape";

export type PastLine = { who: "pau" | "you" | "pick"; text: string; heading?: string | null };

export type SkeletonWords = Partial<
  Record<"intro" | "body" | "conclusion", { locked: boolean; notes: string[]; outline?: string[] }>
>;

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
                {l.who === "pick" ? `Picked: ${l.text}` : l.who === "pau" ? coachNameNow(l.text) : l.text}
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

type Block = SkeletonView["blocks"][number];

/** Which of the student's own words belong to a block. */
export function wordsForBlock(block: Block, bodyBlocks: Block[], words: SkeletonWords): string[] {
  const w = words[block.group];
  if (!w) return [];
  if (block.group !== "body") return [...w.notes, ...(w.outline ?? [])];
  if (block.ideaRefs.length) return block.ideaRefs.map((i) => w.notes[i]).filter((x): x is string => Boolean(x));
  const i = bodyBlocks.findIndex((b) => b.key === block.key);
  const last = i === bodyBlocks.length - 1;
  const own = w.notes.filter((_, j) => Math.min(j, bodyBlocks.length - 1) === i);
  return last ? [...own, ...(w.outline ?? [])] : own;
}

/** Their direction, short: their own sentences, no repeats, no fragments (their words only). */
export function shortDirection(text: string | null | undefined, max = 240): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/)) {
    const sent = raw.trim();
    const key = sent.toLowerCase().replace(/[^a-z ]/g, "");
    if (!sent || /…$/.test(sent) || sent.split(" ").length < 4 || seen.has(key)) continue;
    if ([...seen].some((k) => k.includes(key) || key.includes(k))) continue;
    seen.add(key);
    if (out.length && [...out, sent].join(" ").length > max) break;
    out.push(sent);
    if (out.length === 2) break;
  }
  const t = out.join(" ");
  return t ? (t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t) : null;
}

/** The skeleton: sectioned blocks. Locked ones open the student's own words; empty ones are labels. */
export function SkeletonPanel({
  view,
  words,
  direction,
  onClose,
  waiting,
}: {
  view: SkeletonView | null;
  words: SkeletonWords;
  direction?: string | null;
  onClose: () => void;
  waiting?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const body = useMemo(() => (view?.blocks ?? []).filter((b) => b.group === "body"), [view]);
  const dir = shortDirection(direction);
  return (
    <Overlay label="Your skeleton" onClose={onClose} side data="data-skeleton-panel">
      {dir ? (
        <p className="mb-3 text-[14px] leading-[1.6] text-ds-muted" data-skeleton-direction>
          <span className="font-semibold text-ds-ink">Your direction: </span>
          {dir}
        </p>
      ) : null}
      {!view ? (
        <p className="text-[15px] leading-[1.6] text-ds-muted" role="status">
          {waiting ?? "Your skeleton shows up once I've read your assignment."}
        </p>
      ) : (
        <ol className="space-y-2">
          {view.blocks.map((b) => {
            const w = words[b.group];
            const mine = wordsForBlock(b, body, words);
            const locked = Boolean(w?.locked) && mine.length > 0;
            const n = body.findIndex((x) => x.key === b.key);
            const heading = b.title ? `Body ${n + 1} – ${b.title}` : `${b.label} – ${b.sub}`;
            const transition = b.group === "body" && n > 0 ? view.transitions[n - 1] : null;
            return (
              <li key={b.key}>
                {transition ? (
                  <p className="mb-2 pl-3 text-[12px] leading-[1.5] text-ds-muted" data-skeleton-transition>
                    {transition}
                  </p>
                ) : null}
                {locked ? (
                  <div className="rounded-[10px] border border-ds-border bg-ds-page">
                    <button
                      type="button"
                      className="ds-focus flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                      aria-expanded={open === b.key}
                      data-skeleton-block={b.key}
                      data-locked=""
                      onClick={() => setOpen((o) => (o === b.key ? null : b.key))}
                    >
                      <span className={b.title ? "text-[15px] font-bold text-ds-ink" : "text-[15px] font-semibold text-ds-ink"}>{heading}</span>
                      <span className="text-[13px] text-ds-muted">✓ {open === b.key ? "Hide" : "Open"}</span>
                    </button>
                    {open === b.key ? (
                      <ul className="space-y-2 border-t border-ds-border px-3 py-2" data-skeleton-words={b.key}>
                        {mine.map((t, i) => (
                          <li key={i} className="text-[14px] leading-[1.6] text-ds-ink">
                            {t}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <h3
                    className={b.title ? "px-3 py-1 text-[15px] font-bold text-ds-ink" : "px-3 py-1 text-[15px] font-semibold text-ds-muted"}
                    data-skeleton-empty={b.key}
                  >
                    {heading}
                  </h3>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Overlay>
  );
}

/** The two buttons under the chat header. */
export function FocusBar({ onSkeleton, onPast, hasPast, menu }: { onSkeleton: () => void; onPast: () => void; hasPast: boolean; menu?: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2" data-focus-bar>
      <button type="button" className="ds-focus rounded-full border border-ds-border px-3 py-1 text-[13px] font-semibold text-ds-ink" data-skeleton-open onClick={onSkeleton}>
        See skeleton
      </button>
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
