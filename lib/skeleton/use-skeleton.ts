"use client";

import { useEffect, useRef, useState } from "react";
import { inputHash, projectSkeleton, ruleShape, type SkeletonView } from "@/lib/skeleton/shape";

/**
 * PC-28: the paper's skeleton view (labels, subheadings, short body titles). The server
 * makes ghost paper #1 on the first ask after the assignment is confirmed, and ghost #2
 * once there are body notes and choices. Demo mode (no account) uses the rule shape.
 */
export function useSkeleton(
  paperId: string,
  opts: {
    enabled: boolean;
    /** Assignment text for the demo/offline rule shape. */
    fallbackText: string;
    /** Changes when the student's progress changes (refetch while it matters). */
    refreshKey: string;
    outline?: { choices: string[]; bodyNotes: string[] } | null;
  },
): SkeletonView | null {
  const [view, setView] = useState<SkeletonView | null>(null);
  const [poll, setPoll] = useState(0);
  const lastOutline = useRef<string>("");
  const fallbackRef = useRef(opts.fallbackText);
  const outlineKey = opts.outline && opts.outline.bodyNotes.some((n) => n.trim()) ? inputHash(JSON.stringify(opts.outline)) : "";
  const outlineRef = useRef(opts.outline);
  // Round 4 #1: while ghost #1 (the real shape) is being made, keep asking; give up after a minute.
  const buildingSince = useRef<number | null>(null);
  useEffect(() => {
    fallbackRef.current = opts.fallbackText;
    outlineRef.current = opts.outline;
  });

  useEffect(() => {
    if (!opts.enabled) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const post = Boolean(outlineKey) && outlineKey !== lastOutline.current;
    if (post) lastOutline.current = outlineKey;
    const rules = () => {
      const text = fallbackRef.current.trim();
      return text ? projectSkeleton(ruleShape({ text }), null) : null;
    };
    void fetch(`/api/papers/${paperId}/skeleton`, post
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(outlineRef.current) }
      : { method: "GET", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ view: SkeletonView | null; reason?: string; building?: boolean }>) : null))
      .then((data) => {
        if (!live) return;
        // Demo mode (no account): the rule shape is the skeleton there.
        if (data?.reason === "demo") {
          setView(rules());
          return;
        }
        const building = Boolean(data?.building) || data?.reason === "not_ready" || (!data?.view && data?.reason !== "error");
        if (building) {
          buildingSince.current ??= Date.now();
          if (Date.now() - buildingSince.current < 60_000) {
            // Never the generic template as if it were the real one: "Building…" until it's in.
            timer = setTimeout(() => setPoll((n) => n + 1), 2000);
            return;
          }
        }
        buildingSince.current = null;
        setView(data?.view ?? rules());
      })
      .catch(() => {
        if (!live) return;
        timer = setTimeout(() => setPoll((n) => n + 1), 3000);
      });
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [paperId, opts.enabled, opts.refreshKey, outlineKey, poll]);

  return opts.enabled ? view : null;
}
