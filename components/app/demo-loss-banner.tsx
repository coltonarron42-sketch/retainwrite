"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";

function storageKey(path: string) {
  return `rw_demo_banner:${path}`;
}

/**
 * Shown to demo sessions. Dismissed for the current page only.
 * PLAN.md 8.4 anonymous banner: amber tint of ds-amber, ink text (amber text on a light
 * amber tint is below AA, 8.7).
 */
export function DemoLossBanner() {
  const path = usePathname() || "/app";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.sessionStorage.getItem(storageKey(path)) !== "1");
  }, [path]);

  if (!visible) return null;

  // One thin line at 390 (QA 8:45 PM #3); 48px tap targets stay.
  return (
    <div
      className="border-b border-[rgba(212,160,23,0.4)] border-l-4 border-l-ds-amber bg-[rgba(212,160,23,0.12)] px-4 font-ds-sans text-[14px] leading-[1.4] text-ds-ink md:px-16"
      role="status"
      data-demo-banner
    >
      <div className="mx-auto flex min-h-[48px] max-w-[1100px] items-center gap-2">
        <p className="min-w-0 flex-1 truncate">
          Demo: progress won&apos;t be saved.
          <span className="hidden md:inline"> Create a free account to save and resume anytime — demo work is not copied over.</span>
        </p>
        <Link
          href="/signup"
          className="ds-focus flex min-h-[48px] shrink-0 items-center rounded-[4px] px-1 font-semibold text-ds-ink underline underline-offset-4 hover:text-ds-muted"
        >
          <span className="md:hidden">Sign up free</span>
          <span className="hidden md:inline">Create a free account</span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          className="ds-focus -mr-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] text-ds-muted hover:text-ds-ink"
          onClick={() => {
            window.sessionStorage.setItem(storageKey(path), "1");
            setVisible(false);
          }}
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}
