"use client";

// PC-30: the chats already work out the skeleton (shape view, the student's words, the building
// state); they publish that here so The Skeleton (rendered once per page, outside the chat) shows
// exactly the same thing. This is a view of the live state, not a copy that's saved anywhere.
import { useEffect, useSyncExternalStore } from "react";
import type { SkeletonView } from "@/lib/skeleton/shape";
import type { SkeletonWords } from "@/lib/skeleton/sections";

export type LiveSkeleton = {
  view: SkeletonView | null;
  words: SkeletonWords;
  direction?: string | null;
  /** While there's no shape yet: what to say ("Building your skeleton…"). */
  waiting?: string | null;
  /** The loop session's section keys (intro, body, conclusion). */
  sessionKeys?: string[] | null;
};

const store = new Map<string, LiveSkeleton>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function publishSkeleton(paperId: string, data: LiveSkeleton | null) {
  if (data) store.set(paperId, data);
  else store.delete(paperId);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLiveSkeleton(paperId: string): LiveSkeleton | null {
  return useSyncExternalStore(
    subscribe,
    () => store.get(paperId) ?? null,
    () => null,
  );
}

/** A chat publishes its skeleton while it's on screen. */
export function usePublishSkeleton(paperId: string, data: LiveSkeleton | null) {
  const key = data ? JSON.stringify(data) : "";
  useEffect(() => {
    publishSkeleton(paperId, key ? (JSON.parse(key) as LiveSkeleton) : null);
  }, [paperId, key]);
  useEffect(() => () => publishSkeleton(paperId, null), [paperId]);
}

export const OPEN_EVENT = "rw:skeleton-open";
export const SECTION_EVENT = "rw:skeleton-section";

/** Open The Skeleton from anywhere on the page (e.g. her "see your progress" link). */
export function openSkeleton() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export type SectionRequest = { stage: number; section: string; block: string };

/** Ask the chat on this page to bring a section up (same page, no navigation). */
export function requestSection(req: SectionRequest) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<SectionRequest>(SECTION_EVENT, { detail: req }));
}

/** The chat on this page listens for section requests. */
export function useSectionRequests(stage: number, onRequest: (req: SectionRequest) => void) {
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<SectionRequest>).detail;
      if (d && d.stage === stage) onRequest(d);
    };
    window.addEventListener(SECTION_EVENT, h);
    return () => window.removeEventListener(SECTION_EVENT, h);
  });
}

/** Bring a section into view once the chat has drawn it: scroll, highlight, focus the box. */
export function revealSection(stage: number, section: string) {
  if (typeof document === "undefined") return;
  const run = (tries: number) => {
    let el: HTMLElement | null = null;
    let focusBox = false;
    if (stage === 3) {
      const map = document.querySelector<HTMLDetailsElement>("[data-outline-map]");
      const current = document.querySelector<HTMLElement>(`[data-outline-current="${CSS.escape(section)}"]`);
      if (current) {
        el = current;
        focusBox = true;
      } else {
        if (map) map.open = true;
        el = document.querySelector<HTMLElement>(`[data-outline-row="${CSS.escape(section)}"]`);
      }
    } else {
      el = document.querySelector<HTMLElement>(`[data-section-step][data-section-key="${CSS.escape(section)}"]`);
      focusBox = Boolean(el);
    }
    if (!el) {
      if (tries > 0) window.setTimeout(() => run(tries - 1), 120);
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    el.setAttribute("data-skeleton-target", "");
    window.setTimeout(() => el?.removeAttribute("data-skeleton-target"), 1800);
    if (focusBox) {
      const boxes = document.querySelectorAll<HTMLTextAreaElement>("textarea:not([disabled])");
      boxes[boxes.length - 1]?.focus({ preventScroll: true });
    }
  };
  window.requestAnimationFrame(() => run(25));
}
