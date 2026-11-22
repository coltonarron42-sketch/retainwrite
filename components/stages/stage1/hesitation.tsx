"use client";

import { useEffect, useRef } from "react";
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
}: {
  questionKey: string | null;
  text: string;
  enabled: boolean;
  onHesitate: (questionKey: string, reason: "idle" | "delete") => void;
  idleMs?: number;
}) {
  const maxLen = useRef(0);
  const keyRef = useRef<string | null>(null);
  const cb = useRef(onHesitate);
  useEffect(() => {
    cb.current = onHesitate;
  });

  useEffect(() => {
    if (keyRef.current !== questionKey) {
      keyRef.current = questionKey;
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
  }, [questionKey, text, enabled, idleMs]);
}

const OFFERED_PREFIX = "rw:spark-offered:";

export function wasOffered(paperId: string, questionKey: string): boolean {
  try {
    const list = JSON.parse(window.localStorage.getItem(OFFERED_PREFIX + paperId) ?? "[]") as string[];
    return list.includes(questionKey);
  } catch {
    return false;
  }
}

export function markOffered(paperId: string, questionKey: string) {
  try {
    const list = JSON.parse(window.localStorage.getItem(OFFERED_PREFIX + paperId) ?? "[]") as string[];
    if (!list.includes(questionKey)) list.push(questionKey);
    window.localStorage.setItem(OFFERED_PREFIX + paperId, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
