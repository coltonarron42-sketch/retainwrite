"use client";

import { useCallback, useRef, useState } from "react";

export type PasteMeta = {
  pastedChars: number;
  typedChars: number;
  pasteEvents: number;
  pasteRatio: number;
};

const empty = (): PasteMeta => ({
  pastedChars: 0,
  typedChars: 0,
  pasteEvents: 0,
  pasteRatio: 0,
});

/**
 * Passive paste/typing measurement. Never calls preventDefault.
 * Paste/drop count as pasted; other input (incl. dictation/autocorrect) as typed.
 */
export function usePasteMeta() {
  const [meta, setMeta] = useState<PasteMeta>(empty);
  const pendingPaste = useRef(0);

  const reset = useCallback(() => {
    pendingPaste.current = 0;
    setMeta(empty());
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData("text") ?? "";
    pendingPaste.current += text.length;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    const text = e.dataTransfer?.getData("text") ?? "";
    if (text) pendingPaste.current += text.length;
  }, []);

  const onBeforeInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const ne = e.nativeEvent as InputEvent;
    if (
      ne.inputType === "insertFromPaste" ||
      ne.inputType === "insertFromDrop" ||
      ne.inputType === "insertFromPasteAsQuotation"
    ) {
      // counted on paste/drop; avoid double-count if data is empty here
      return;
    }
  }, []);

  const onChange = useCallback(
    (prevValue: string, nextValue: string) => {
      const delta = nextValue.length - prevValue.length;
      if (delta <= 0) {
        // deletions / edits — leave counters as-is for ratio of content added
        return;
      }
      const fromPaste = Math.min(pendingPaste.current, delta);
      pendingPaste.current = Math.max(0, pendingPaste.current - fromPaste);
      const typed = delta - fromPaste;
      setMeta((m) => {
        const pastedChars = m.pastedChars + fromPaste;
        const typedChars = m.typedChars + typed;
        const pasteEvents = m.pasteEvents + (fromPaste > 0 ? 1 : 0);
        const total = pastedChars + typedChars;
        return {
          pastedChars,
          typedChars,
          pasteEvents,
          pasteRatio: total > 0 ? pastedChars / total : 0,
        };
      });
    },
    [],
  );

  return { meta, reset, onPaste, onDrop, onBeforeInput, onChange };
}
