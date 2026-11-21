"use client";

import { useEffect, useRef, useState } from "react";
import { persistField } from "@/lib/papers/persist";
import { DRAFT_SAVE_DELAY_MS } from "@/lib/papers/resume";

export type SaveStatusValue = "idle" | "saving" | "saved";

/** Save in-progress text after typing pauses. Does not block the field. */
export function useDraftSave(input: {
  paperId: string;
  fieldKey: string;
  text: string;
  enabled: boolean;
}): SaveStatusValue {
  const [status, setStatus] = useState<SaveStatusValue>("idle");
  const skipMount = useRef(true);

  const latest = useRef(input);
  latest.current = input;

  useEffect(() => {
    if (!input.enabled) return;
    if (skipMount.current) {
      skipMount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setStatus("saving");
      void persistField(input.paperId, {
        fieldKey: input.fieldKey,
        text: input.text,
        submitted: false,
      }).then((ok) => setStatus(ok ? "saved" : "idle"));
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [input.enabled, input.fieldKey, input.paperId, input.text]);

  useEffect(() => {
    function flush() {
      const current = latest.current;
      if (!current.enabled || !current.text.trim()) return;
      setStatus("saving");
      void persistField(current.paperId, {
        fieldKey: current.fieldKey,
        text: current.text,
        submitted: false,
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
