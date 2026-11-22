"use client";

import { useEffect, useRef, useState } from "react";
import { writeLocalDraft } from "@/lib/papers/local-draft";
import { persistField } from "@/lib/papers/persist";
import { DRAFT_SAVE_DELAY_MS, type ResumePointer } from "@/lib/papers/resume";

export type SaveStatusValue = "idle" | "saving" | "saved";

/** Save in-progress text after typing pauses. Does not block the field. */
export function useDraftSave(input: {
  paperId: string;
  fieldKey: string;
  text: string;
  enabled: boolean;
  resume?: ResumePointer;
  /** Also keep a same-browser copy on every change (instant reload restore). */
  localCopy?: boolean;
}): SaveStatusValue {
  const [status, setStatus] = useState<SaveStatusValue>("idle");
  // Text already known for this field (loaded, prefilled, or saved). Moving
  // between questions changes the field and the text together, so that is a
  // new baseline, not an edit; only real changes against it are saved.
  const baseline = useRef({ fieldKey: input.fieldKey, text: input.text });

  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  useEffect(() => {
    if (!input.enabled) return;
    if (baseline.current.fieldKey !== input.fieldKey) {
      baseline.current = { fieldKey: input.fieldKey, text: input.text };
      setStatus("idle");
      return;
    }
    if (baseline.current.text === input.text) return;
    if (input.localCopy) writeLocalDraft(input.paperId, input.fieldKey, input.text);
    // Only say "Saving…" while the request is in flight. During the typing
    // pause the text is not saved yet, so drop a stale "Saved" instead.
    setStatus("idle");
    const timer = window.setTimeout(() => {
      const current = latest.current;
      setStatus("saving");
      void persistField(current.paperId, {
        fieldKey: current.fieldKey,
        text: current.text,
        submitted: false,
        resume: current.resume,
      }).then((ok) => {
        if (ok) baseline.current = { fieldKey: current.fieldKey, text: current.text };
        setStatus(ok ? "saved" : "idle");
      });
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [input.enabled, input.fieldKey, input.paperId, input.text, input.localCopy]);

  useEffect(() => {
    function flush() {
      const current = latest.current;
      if (!current.enabled || !current.text.trim()) return;
      setStatus("saving");
      void persistField(current.paperId, {
        fieldKey: current.fieldKey,
        text: current.text,
        submitted: false,
        resume: current.resume,
      }).then((ok) => setStatus(ok ? "saved" : "idle"));
    }
    function onHide() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return status;
}
