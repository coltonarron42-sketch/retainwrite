"use client";

import { useEffect, useRef } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { PauPauGroup } from "@/components/stages/stage1/chat-bubbles";
import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { SPARK_OFFER } from "@/lib/stage1/spark";
import { HESITATION_DELETE_SETTLE_MS, HESITATION_IDLE_MS, isHeavyDelete } from "@/lib/stage1/spark";

/**
 * Rule-based hesitation: on an open question, the student started typing and
 * then went quiet for ~25s without sending, or deleted most of what they wrote.
 * Never fires on a box that has stayed empty.
 */
export function useHesitation({
  questionKey,
  text,
  enabled,
  onHesitate,
  idleMs = HESITATION_IDLE_MS,
  resetKey,
}: {
  questionKey: string | null;
  text: string;
  enabled: boolean;
  onHesitate: (questionKey: string, reason: "idle" | "delete") => void;
  idleMs?: number;
  /** QA round 6: changes when they send: the box emptying on a send is not "deleted most of it". */
  resetKey?: string;
}) {
  const maxLen = useRef(0);
  const keyRef = useRef<string | null>(null);
  const resetRef = useRef(resetKey);
  const cb = useRef(onHesitate);
  useEffect(() => {
    cb.current = onHesitate;
  });

  useEffect(() => {
    if (keyRef.current !== questionKey || resetRef.current !== resetKey) {
      keyRef.current = questionKey;
      resetRef.current = resetKey;
      maxLen.current = text.trim().length;
    }
    if (!enabled || !questionKey) return;
    const len = text.trim().length;
    maxLen.current = Math.max(maxLen.current, len);
    const heavy = isHeavyDelete(maxLen.current, len);
    const started = len > 0;
    if (!heavy && !started) return;
    const key = questionKey;
    const t = window.setTimeout(
      () => cb.current(key, heavy ? "delete" : "idle"),
      heavy ? HESITATION_DELETE_SETTLE_MS : idleMs,
    );
    return () => window.clearTimeout(t);
  }, [questionKey, text, enabled, idleMs, resetKey]);
}

export type SparkTurn = {
  status: "offer" | "loading" | "shown" | "declined" | "off";
  questions?: string[];
};

/** One record per question, scoped to this user and paper. Present = already offered. */
const name = (paperId: string) => `spark:${paperId}`;

export function loadSparks(paperId: string): Record<string, SparkTurn> {
  try {
    const raw = readScoped(name(paperId));
    const parsed = raw ? (JSON.parse(raw) as Record<string, SparkTurn>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSparks(paperId: string, sparks: Record<string, SparkTurn>) {
  writeScoped(name(paperId), JSON.stringify(sparks));
}

/**
 * The spark exchange as Pau's bubbles only. The student's tap is not shown
 * as a speech bubble (they didn't write it); the buttons simply go away.
 */
export function SparkExchange({
  turn,
  active,
  onYes,
  onNo,
  onOff,
  inline = false,
}: {
  turn: SparkTurn;
  active: boolean;
  onYes: () => void;
  onNo: () => void;
  onOff: () => void;
  /** Rendered inside the current question's bubble as a soft last paragraph (never its own bubble). */
  inline?: boolean;
}) {
  // One reply (PLAN.md 9): the offer, its choices, and Pau's answer to the
  // choice all live in the same message block.
  const reply =
    turn.status === "loading" ? (
      <span key="loading" role="status">Thinking of a couple of questions…</span>
    ) : turn.status === "declined" ? (
      SPARK_DECLINED
    ) : turn.status === "off" ? (
      SPARK_OFF
    ) : turn.status === "shown" && turn.questions?.length ? (
      <ul key="qs" className="list-disc space-y-2 pl-5" aria-label="Questions to think about">
        {/* QA round 6: each question is its own line in Past chat (one ask per line), true to the list on screen. */}
        {turn.questions.map((q) => (
          <li key={q} data-chat-part>
            {q}
          </li>
        ))}
      </ul>
    ) : null;
  const extras = (
    <>
        {turn.status === "offer" && active ? (
          <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Want some questions?">
            <DsButton type="button" size="sm" variant="secondary" onClick={onYes}>
              Yes
            </DsButton>
            <DsButton type="button" size="sm" variant="ghost" onClick={onNo}>
              No thanks
            </DsButton>
            <button
              type="button"
              className="ds-focus min-h-[48px] px-2 text-[13px] text-ds-muted underline-offset-4 hover:underline"
              onClick={onOff}
            >
              Don&apos;t offer again
            </button>
          </div>
        ) : null}
        {turn.status === "shown" && turn.questions?.length && active ? (
          <p className="text-[13px] leading-[1.6] text-ds-muted">
            No need to answer these. Write whatever comes to you, in your own words.
          </p>
        ) : null}
    </>
  );
  if (inline) {
    return (
      <div
        data-spark
        data-chat-part
        data-spark-status={turn.status}
        className="space-y-2 border-t border-ds-border pt-3 text-ds-text"
        aria-live={active ? "polite" : undefined}
      >
        <p className="text-ds-muted">{SPARK_OFFER}</p>
        {reply ? typeof reply === "string" ? <p>{reply}</p> : reply : null}
        {extras}
      </div>
    );
  }
  return (
    <div data-spark data-spark-status={turn.status}>
      <PauPauGroup bubbles={[SPARK_OFFER, reply]} live={active && turn.status !== "offer"}>
        {extras}
      </PauPauGroup>
    </div>
  );
}

export const SPARK_DECLINED = "No problem. Take your time.";
export const SPARK_OFF = "Got it. I won't offer again.";
