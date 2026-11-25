"use client";

import { useEffect, useRef, useState } from "react";
import { PauPauGroup } from "@/components/stages/stage1/chat-bubbles";
import { welcomeBackLine, type WelcomeFill } from "@/lib/coach/welcome-back";
import { DsButton } from "@/components/ui/ds-button";
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

export type FocusState = {
  /** History existed when this visit opened: the chat starts clean (PC-28). */
  focused: boolean;
  /** This visit is a return (page load / from outside the paper): Pau Pau opens with one line. */
  line: string | null;
  index: number;
  /** Show the earlier turns in place (only for an explicit "edit an earlier answer"). */
  unfocus: () => void;
};

/**
 * PC-28 (Colton t185u): decides ONCE per visit, when the restored state is ready,
 * whether the chat opens clean. Every return with history opens a clean active chat,
 * one random welcome-back line with the real last-locked piece and the next one, then
 * the exact prompt they were on. The old chat stays saved and reachable ("Past chat").
 */
export function useFocusReturn(paperId: string, ready: boolean, hasHistory: boolean, fill: WelcomeFill): FocusState {
  const decided = useRef(false);
  const fillRef = useRef(fill);
  useEffect(() => {
    fillRef.current = fill;
  });
  const [state, setState] = useState<{ focused: boolean; line: string | null; index: number }>({ focused: false, line: null, index: 0 });
  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    if (!hasHistory) return;
    const returning = claimReturn(paperId);
    const pick = welcomeBackLine(fillRef.current);
    setState({ focused: true, line: returning ? pick.line : null, index: pick.index });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [ready, hasHistory, paperId]);
  return { ...state, unfocus: () => setState((s) => ({ ...s, focused: false })) };
}

/**
 * Pau Pau's one opener on a return, with the two answers: keep going (the prompt
 * below is where they left off) or check the progress (opens the skeleton). It steps
 * aside once the chat moves on, so it never sits under newer turns.
 */
export function FocusOpener({
  line,
  scope,
  signal,
  silent = false,
  onProgress,
}: {
  line: string | null;
  scope: string;
  signal: string | number;
  silent?: boolean;
  onProgress: () => void;
}) {
  const [atSignal, setAtSignal] = useState<string | number | null>(null);
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    if (line && atSignal === null) setAtSignal(signal);
  }, [line, signal, atSignal]);
  const { voice } = useChatPrefs();
  const shownAt = useRef(0);
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (line && !shownAt.current) shownAt.current = Date.now();
  }, [line]);
  useEffect(() => {
    if (silent || !line || !voice || spoken.current === line || Date.now() - shownAt.current > 4000) return;
    spoken.current = line;
    markHeard(scope, [line]);
    speak([line], { welcome: true });
  }, [line, voice, scope, silent]);
  if (!line || (atSignal !== null && atSignal !== signal)) return null;
  return (
    <div data-welcome-back data-focus-opener>
      <PauPauGroup bubbles={[line]}>
        {answered ? null : (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Pick up or check progress">
            <DsButton type="button" size="sm" variant="primary" data-focus-continue onClick={() => setAnswered(true)}>
              Keep going
            </DsButton>
            <DsButton
              type="button"
              size="sm"
              variant="secondary"
              data-focus-progress
              onClick={() => {
                setAnswered(true);
                onProgress();
              }}
            >
              Check the progress
            </DsButton>
          </div>
        )}
      </PauPauGroup>
    </div>
  );
}

/** @deprecated PC-28: the welcome line now comes from useFocusReturn + FocusOpener. */
export function useWelcomeBack(paperId: string, ready: boolean, hasHistory: boolean): string | null {
  return useFocusReturn(paperId, ready, hasHistory, { done: null, next: "the next step" }).line;
}
