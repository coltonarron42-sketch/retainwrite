"use client";

// PC-30 (Colton t197u): The Skeleton. A small tab on the right edge of every writing-stage page
// opens a full-screen, dark view of the whole paper in order. Done sections are white cards with
// the student's own saved words; the rest are just their titles. Hover (desktop) or press-and-hold
// (touch) lifts a section; click / release opens it where it's worked on now.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { SkeletonView } from "@/lib/skeleton/shape";
import { HOLD_MS, IDLE, pressReduce, type PressEvent, type PressState } from "@/lib/skeleton/long-press";
import { OPEN_EVENT, requestSection, revealSection, useLiveSkeleton } from "@/lib/skeleton/live";
import { paperSections, previewText, shortDirection, sectionHref, sectionTarget, skeletonWordsFromSession, type PaperSection, type SessionSectionLike, type SkeletonWords } from "@/lib/skeleton/sections";

type Props = {
  paperId: string;
  /** The stage page this is on. */
  stage: number;
  /** The paper's own stage (what's live). */
  paperStage: number;
  /** Demo papers have no account data to fetch. */
  demoMode?: boolean;
  /** The assignment asks for a title page. */
  titlePage?: boolean;
};

type Fetched = { view: SkeletonView | null; building: boolean; words: SkeletonWords | null; sessionKeys: string[] | null };

const BUILDING = "Building your skeleton…";

export function SkeletonDock({ paperId, stage, paperStage, demoMode = false, titlePage = false }: Props) {
  const router = useRouter();
  const live = useLiveSkeleton(paperId);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Opening a section moves focus into the chat (its box); closing otherwise goes back to the tab.
  const opening = useRef(false);

  const show = useCallback(() => {
    opening.current = false;
    returnFocus.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, [show]);

  // Always the latest saved state: ask again every time it opens (and while the shape is being built).
  useEffect(() => {
    if (!open || demoMode) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();
    const needWords = !live?.words || Object.keys(live.words).length === 0;
    const load = async () => {
      try {
        const [skel, saved] = await Promise.all([
          fetch(`/api/papers/${paperId}/skeleton`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)) as Promise<{ view?: SkeletonView | null; building?: boolean; reason?: string } | null>,
          needWords && paperStage >= 2
            ? (fetch(`/api/papers/${paperId}/autosave`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)) as Promise<{ session?: { sections?: SessionSectionLike[]; outlineDone?: string[] } } | null>)
            : Promise.resolve(null),
        ]);
        if (!alive) return;
        const sections = saved?.session?.sections ?? null;
        const building = Boolean(skel?.building) || skel?.reason === "not_ready";
        setFetched({
          view: skel?.view ?? null,
          building,
          words: sections ? skeletonWordsFromSession(sections, saved?.session?.outlineDone ?? []) : null,
          sessionKeys: sections ? sections.map((s) => s.key) : null,
        });
        // The real shape is on its way: keep asking (like the chat does), for up to a minute.
        if (building && skel?.reason !== "not_ready" && Date.now() - started < 60_000) timer = setTimeout(() => void load(), 2000);
      } catch {
        /* the chat's copy still shows */
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // Refetch per open, not per keystroke in the chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paperId, demoMode, paperStage]);

  // A fresh, finished shape from the server wins; otherwise what the chat shows.
  const view = fetched?.view && !fetched.building ? fetched.view : (live?.view ?? null);
  const liveWords = live?.words;
  const fetchedWords = fetched?.words;
  const words = useMemo<SkeletonWords>(() => (liveWords && Object.keys(liveWords).length ? liveWords : (fetchedWords ?? {})), [liveWords, fetchedWords]);
  const sessionKeys = live?.sessionKeys ?? fetched?.sessionKeys ?? null;
  const sections = useMemo(() => paperSections({ view, words, titlePage, sessionKeys }), [view, words, titlePage, sessionKeys]);
  const waiting = view ? null : (live?.waiting ?? (fetched?.building ? BUILDING : paperStage >= 2 ? BUILDING : "Share your assignment and I'll sketch your skeleton right away."));

  const openSection = (s: PaperSection) => {
    const target = sectionTarget(paperStage, s);
    if (!target) return;
    opening.current = true;
    setOpen(false);
    if (target.stage === stage) {
      requestSection({ stage: target.stage, section: target.section, block: s.id });
      revealSection(target.stage, target.section);
    } else {
      router.push(sectionHref(paperId, target));
    }
  };

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open The Skeleton: your whole paper, section by section"
        title="The Skeleton"
        data-skeleton-open
        data-skeleton-tab
        className="ds-focus fixed right-0 top-[38%] z-30 flex h-14 w-7 items-center justify-center rounded-l-[10px] border border-r-0 border-white/10 bg-[#17181b] text-[#c9cacd] shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-[width,background-color] duration-150 hover:w-9 hover:bg-[#222327] md:h-16 md:w-9 md:hover:w-11"
        style={{ marginRight: "env(safe-area-inset-right)" }}
      >
        <SpineIcon />
      </button>
      {open ? (
        <SkeletonOverlay
          sections={sections}
          waiting={waiting}
          direction={shortDirection(live?.direction)}
          interactive={(s) => Boolean(sectionTarget(paperStage, s))}
          onOpen={openSection}
          onClose={close}
          returnFocus={() => (opening.current ? null : returnFocus.current && document.contains(returnFocus.current) ? returnFocus.current : tabRef.current)}
        />
      ) : null}
    </>
  );
}

function SpineIcon() {
  return (
    <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden="true">
      <rect x="3" y="1" width="8" height="3" rx="1.5" fill="currentColor" />
      <rect x="1" y="6.5" width="12" height="3" rx="1.5" fill="currentColor" />
      <rect x="1" y="12" width="12" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="17.5" width="8" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Keeps the page where it was: no scroll behind the overlay, same spot after (iOS too). */
function useScrollLock() {
  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
    };
  }, []);
}

export function SkeletonOverlay({
  sections,
  waiting,
  direction,
  interactive,
  onOpen,
  onClose,
  returnFocus,
}: {
  sections: PaperSection[];
  waiting: string | null;
  direction: string | null;
  interactive: (s: PaperSection) => boolean;
  onOpen: (s: PaperSection) => void;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);
  useScrollLock();

  useEffect(() => {
    // QA #2: the page behind is out of reach (screen readers, Tab, clicks) while this is open.
    const undo = inertBehind(dialogRef.current);
    closeRef.current?.focus({ preventScroll: true });
    const raf = requestAnimationFrame(() => setShown(true));
    const back = returnFocus;
    // Escape must close no matter where focus is: clicking a non-interactive title
    // (live Stage 1) can blur the dialog so a div onKeyDown never sees the key.
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onDocKey, true);
    return () => {
      document.removeEventListener("keydown", onDocKey, true);
      undo();
      cancelAnimationFrame(raf);
      // Focus goes back where it was (the tab) when it closes.
      const el = back();
      window.setTimeout(() => el?.focus({ preventScroll: true }), 0);
    };
    // once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const root = dialogRef.current;
    if (!root) return;
    if (e.key === "Tab") {
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      const items = [...root.querySelectorAll<HTMLElement>("[data-skeleton-item]")];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? Math.min(items.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      e.preventDefault();
      items[next]?.focus();
      items[next]?.scrollIntoView({ block: "nearest" });
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="skeleton-title"
      data-skeleton-panel
      data-skeleton-overlay
      onKeyDown={onKeyDown}
      className={`skel-overlay fixed inset-0 z-[70] flex flex-col bg-[#111214] text-[#e7e7e9] ${shown ? "skel-overlay-in" : ""}`}
      style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-5">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="skel-focus inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-[#e7e7e9] hover:bg-white/10"
          data-skeleton-close
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="md:hidden">Back</span>
          <span className="hidden md:inline">Back to your work</span>
        </button>
        <h2 id="skeleton-title" className="whitespace-nowrap font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8e8f94] md:text-[15px]">
          The Skeleton
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close The Skeleton"
          className="skel-focus inline-flex h-11 w-11 items-center justify-center rounded-full text-[#e7e7e9] hover:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto w-full max-w-[600px] px-5 pb-10 pt-4 md:pt-8">
          {direction ? (
            <p className="mx-auto mb-10 max-w-[480px] text-center text-[14px] leading-[1.6] text-[#8e8f94]" data-skeleton-direction>
              {direction}
            </p>
          ) : null}
          {!sections.length ? (
            <p className="mt-[20vh] text-center text-[16px] text-[#a3a4a9]" role="status" data-skeleton-waiting>
              <span className="skel-pulse">{waiting ?? BUILDING}</span>
            </p>
          ) : (
            <SectionList sections={sections} interactive={interactive} onOpen={onOpen} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Makes everything in <body> except the dialog inert (and hidden from screen readers), and
 * returns how to undo it. Elements that were already inert stay that way. Vercel's preview
 * toolbar is left alone (it's not part of the app).
 */
export function inertBehind(dialog: HTMLElement | null): () => void {
  if (!dialog || typeof document === "undefined") return () => {};
  const changed: HTMLElement[] = [];
  for (const el of Array.from(document.body.children)) {
    if (!(el instanceof HTMLElement) || el === dialog || el.contains(dialog)) continue;
    if (el.inert || /^(script|style|vercel-live-feedback)$/i.test(el.tagName)) continue;
    el.inert = true;
    el.setAttribute("data-skeleton-inert", "");
    changed.push(el);
  }
  return () => {
    for (const el of changed) {
      el.inert = false;
      el.removeAttribute("data-skeleton-inert");
    }
  };
}

function SectionList({ sections, interactive, onOpen }: { sections: PaperSection[]; interactive: (s: PaperSection) => boolean; onOpen: (s: PaperSection) => void }) {
  const [press, setPress] = useState<PressState>(IDLE);
  const pressRef = useRef<PressState>(IDLE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchUp = useRef(0);
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const dispatch = (ev: PressEvent) => {
    const r = pressReduce(pressRef.current, ev);
    pressRef.current = r.state;
    setPress(r.state);
    if (r.state.phase !== "pressing" && timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (r.open) {
      const s = byId.get(r.open);
      if (s) onOpen(s);
    }
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const touchy = (e: ReactPointerEvent) => e.pointerType === "touch" || e.pointerType === "pen";

  return (
    <ol className="flex flex-col items-stretch gap-9" aria-label="Your paper, in order">
      {sections.map((s) => {
        const can = interactive(s);
        const lifted = press.phase === "lifted" && press.id === s.id;
        const content = (
          <>
            {s.kicker ? (
              <span className="mb-1 block text-center text-[11px] font-medium uppercase tracking-[0.14em] text-[#6f7076]" data-skeleton-kicker>
                {s.kicker}
                <span className="sr-only">: </span>
              </span>
            ) : null}
            <span className="block text-center font-display text-[15px] font-medium tracking-[0.02em] text-[#a3a4a9] md:text-[16px]" data-skeleton-title>
              {s.title}
              {s.completed ? null : <span className="sr-only"> (not started yet)</span>}
            </span>
            {s.completed ? (
              <span className="skel-card mt-3 block rounded-[4px] bg-white px-5 py-4 text-left text-[15px] leading-[1.65] text-black md:px-6 md:py-5" data-skeleton-words={s.id}>
                <span className="skel-clamp block">{previewText(s.preview)}</span>
              </span>
            ) : null}
          </>
        );
        return (
          <li key={s.id} data-skeleton-row={s.id} data-completed={s.completed ? "" : undefined}>
            {can ? (
              <button
                type="button"
                data-skeleton-item
                data-skeleton-block={s.id}
                data-locked={s.completed ? "" : undefined}
                data-lifted={lifted ? "" : undefined}
                className={`skel-item skel-focus block w-full cursor-pointer rounded-[6px] p-1 ${s.completed ? "skel-item-card" : "skel-item-title"}`}
                onClick={(e) => {
                  // Touch opens on release after a hold (below), never on a plain tap.
                  if (Date.now() - lastTouchUp.current < 700 && e.detail !== 0) return;
                  onOpen(s);
                }}
                onPointerDown={(e) => {
                  if (!touchy(e)) return;
                  dispatch({ type: "down", id: s.id, x: e.clientX, y: e.clientY, t: performance.now() });
                  timer.current = setTimeout(() => dispatch({ type: "tick", t: performance.now() }), HOLD_MS);
                }}
                onPointerMove={(e) => {
                  if (touchy(e)) dispatch({ type: "move", x: e.clientX, y: e.clientY });
                }}
                onPointerUp={(e) => {
                  if (!touchy(e)) return;
                  lastTouchUp.current = Date.now();
                  dispatch({ type: "up", t: performance.now() });
                }}
                onPointerCancel={() => dispatch({ type: "cancel" })}
                onPointerLeave={(e) => {
                  if (touchy(e)) dispatch({ type: "cancel" });
                }}
                onKeyDown={(e) => {
                  // QA #6: Space opens a focused section exactly like Enter (once, on key down).
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    if (!e.repeat) onOpen(s);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {content}
              </button>
            ) : (
              <div className="p-1" data-skeleton-empty={s.completed ? undefined : s.id}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
