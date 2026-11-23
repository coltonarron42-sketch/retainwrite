"use client";

import { useEffect, useRef, useState } from "react";
import { PauPauGroup } from "@/components/stages/stage1/chat-bubbles";
import { parseWelcomeState, welcomeBackLine } from "@/lib/coach/welcome-back";
import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { useChatPrefs } from "@/lib/voice/prefs";
import { markHeard, speak } from "@/lib/voice/speech";

/** The stage in /app/papers/<id>/stage/<n> (1 when it isn't there). */
export function stageFromPath(path: string): number {
  const m = /\/stage\/(\d+)/.exec(path);
  return m ? Number(m[1]) : 1;
}

/** Where the welcome-back cooldown lives: one per paper and stage. */
export function welcomeStateName(paperId: string, stage: number): string {
  return `welcome:${paperId}:s${stage}`;
}

/** The paper in a /papers/<id>/… path, or null (the dashboard, anything else). */
export function paperFromPath(path: string): string | null {
  const m = /\/papers\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]!) : null;
}

// One welcome decision per RETURN (QA 6:53 PM #2). A return is a page load or
// new session (this module starts fresh) or arriving from outside the paper
// (the dashboard). Moving between a paper's stages in the same session is not
// a return, so it never adds a second welcome.
let returnPaper: string | null = null;
let watching = false;

function notePath(): void {
  if (returnPaper && paperFromPath(window.location.pathname) !== returnPaper) returnPaper = null;
}

function watchPaths(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  for (const name of ["pushState", "replaceState"] as const) {
    const original = window.history[name];
    window.history[name] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const out = original.apply(this, args);
      notePath();
      return out;
    } as History["pushState"];
  }
  window.addEventListener("popstate", notePath);
}

/** True the first time a paper's chat opens on this return; false for stage-to-stage moves. */
export function claimReturn(paperId: string): boolean {
  watchPaths();
  notePath();
  if (returnPaper === paperId) return false;
  returnPaper = paperId;
  return true;
}

/** Tests only. */
export function resetReturnForTests(): void {
  returnPaper = null;
}

/**
 * Decides ONCE per visit, when the restored history is ready, whether Pau Pau
 * says a welcome-back line (Colton 3:46 PM). Call it in the component that
 * lives for the whole visit, so a chat that starts empty never gets one, even
 * after the student replies, and moving between screens never adds another.
 */
export function useWelcomeBack(paperId: string, ready: boolean, hasHistory: boolean): string | null {
  const decided = useRef(false);
  const [line, setLine] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    // Any restored history opens at the bottom, welcome line or not.
    if (hasHistory) setRestored(true);
    // Only a chat with history spends this return's one welcome, so a mount
    // that renders before its history (then remounts) never eats it.
    if (!hasHistory || !claimReturn(paperId)) return;
    // Per paper AND stage (QA 4:42 #6a): a Stage 2 welcome never silences Stage 3.
    const name = welcomeStateName(paperId, stageFromPath(window.location.pathname));
    const pick = welcomeBackLine({ hasHistory, last: parseWelcomeState(readScoped(name)), now: Date.now() });
    if (!pick) return;
    writeScoped(name, JSON.stringify(pick.next));
    setLine(pick.line);
  }, [ready, hasHistory, paperId]);
  useEffect(() => {
    if (!restored) return;
    const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
    const timers = [0, 300, 1000].map((ms) => window.setTimeout(toBottom, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [restored]);
  return line;
}

/** The welcome-back turn at the end of the restored chat. Only this line is spoken. */
export function WelcomeBack({ line, scope, signal, silent = false }: { line: string | null; scope: string; signal: string | number; silent?: boolean }) {
  // It greets the return, then steps aside: once the chat moves on (a reply, a
  // new turn), it's gone, so it never sits under newer turns.
  const [atSignal, setAtSignal] = useState<string | number | null>(null);
  useEffect(() => {
    if (line && atSignal === null) setAtSignal(signal);
  }, [line, signal, atSignal]);
  const { voice } = useChatPrefs();
  const shownAt = useRef(0);
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (!line) return;
    if (!shownAt.current) shownAt.current = Date.now();
    // Restored history opens at the bottom, with this line in view above the
    // pinned composer (the thread's spacer leaves room for it).
    const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
    const timers = [0, 300, 1000].map((ms) => window.setTimeout(toBottom, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [line]);
  useEffect(() => {
    // Voice prefs can load a moment late; after that, the Voice switch reads it.
    if (silent || !line || !voice || spoken.current === line || Date.now() - shownAt.current > 4000) return;
    spoken.current = line;
    markHeard(scope, [line]);
    speak([line]);
  }, [line, voice, scope, silent]);
  if (!line || (atSignal !== null && atSignal !== signal)) return null;
  return (
    <div data-welcome-back>
      <PauPauGroup bubbles={[line]} />
    </div>
  );
}
