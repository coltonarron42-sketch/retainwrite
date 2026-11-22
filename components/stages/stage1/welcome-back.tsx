"use client";

import { useEffect, useRef, useState } from "react";
import { PauPauGroup } from "@/components/stages/stage1/chat-bubbles";
import { parseWelcomeState, welcomeBackLine } from "@/lib/coach/welcome-back";
import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { useChatPrefs } from "@/lib/voice/prefs";
import { markHeard, speak } from "@/lib/voice/speech";

/**
 * Decides ONCE per visit, when the restored history is ready, whether Pau Pau
 * says a welcome-back line (Colton 3:46 PM). Call it in the component that
 * lives for the whole visit, so a chat that starts empty never gets one, even
 * after the student replies, and moving between screens never adds another.
 */
export function useWelcomeBack(paperId: string, ready: boolean, hasHistory: boolean): string | null {
  const decided = useRef(false);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    const name = `welcome:${paperId}`;
    const pick = welcomeBackLine({ hasHistory, last: parseWelcomeState(readScoped(name)), now: Date.now() });
    if (!pick) return;
    writeScoped(name, JSON.stringify(pick.next));
    setLine(pick.line);
  }, [ready, hasHistory, paperId]);
  return line;
}

/** The welcome-back turn at the end of the restored chat. Only this line is spoken. */
export function WelcomeBack({ line, scope, signal }: { line: string | null; scope: string; signal: string | number }) {
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
    if (!line || !voice || spoken.current === line || Date.now() - shownAt.current > 4000) return;
    spoken.current = line;
    markHeard(scope, [line]);
    speak([line]);
  }, [line, voice, scope]);
  if (!line || (atSignal !== null && atSignal !== signal)) return null;
  return (
    <div data-welcome-back>
      <PauPauGroup bubbles={[line]} />
    </div>
  );
}
