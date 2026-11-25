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
  const lastOutline = useRef<string>("");
  const fallbackRef = useRef(opts.fallbackText);
  const outlineKey = opts.outline && opts.outline.bodyNotes.some((n) => n.trim()) ? inputHash(JSON.stringify(opts.outline)) : "";
  const outlineRef = useRef(opts.outline);
  useEffect(() => {
    fallbackRef.current = opts.fallbackText;
    outlineRef.current = opts.outline;
  });

  useEffect(() => {
    if (!opts.enabled) return;
    let live = true;
    const post = Boolean(outlineKey) && outlineKey !== lastOutline.current;
    if (post) lastOutline.current = outlineKey;
    void fetch(`/api/papers/${paperId}/skeleton`, post
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(outlineRef.current) }
      : { method: "GET" })
      .then((r) => (r.ok ? (r.json() as Promise<{ view: SkeletonView | null; reason?: string }>) : null))
      .then((data) => {
        if (!live) return;
        if (data?.view) setView(data.view);
        else if (data?.reason === "demo" || !data) {
          const text = fallbackRef.current.trim();
          if (text) setView(projectSkeleton(ruleShape({ text }), null));
        }
      })
      .catch(() => {
        const text = fallbackRef.current.trim();
        if (live && text) setView((v) => v ?? projectSkeleton(ruleShape({ text }), null));
      });
    return () => {
      live = false;
    };
  }, [paperId, opts.enabled, opts.refreshKey, outlineKey]);

  return view;
}
