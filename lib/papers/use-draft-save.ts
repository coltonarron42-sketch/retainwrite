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

  return status;
}
