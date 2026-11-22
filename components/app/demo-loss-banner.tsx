"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  return (
    <div
      className="border-b border-[rgba(212,160,23,0.4)] border-l-4 border-l-ds-amber bg-[rgba(212,160,23,0.12)] px-6 py-3 font-ds-sans text-[16px] leading-[1.6] text-ds-ink md:px-16"
      role="status"
    >
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p>
          Progress won&apos;t be saved. Create a free account to save and resume anytime — demo work is
          not copied over.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/signup"
            className="ds-focus rounded-[4px] font-semibold text-ds-ink underline underline-offset-4 hover:text-ds-muted"
          >
            Create a free account
          </Link>
          <button
            type="button"
            className="ds-focus rounded-[4px] font-semibold text-ds-muted underline underline-offset-4 hover:text-ds-ink"
            onClick={() => {
              window.sessionStorage.setItem(storageKey(path), "1");
              setVisible(false);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
