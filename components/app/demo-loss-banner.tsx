"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function storageKey(path: string) {
  return `rw_demo_banner:${path}`;
}

/** Shown to demo sessions. Dismissed for the current page only. */
export function DemoLossBanner() {
  const path = usePathname() || "/app";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.sessionStorage.getItem(storageKey(path)) !== "1");
  }, [path]);

  if (!visible) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950" role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p>
          Progress on this device can be lost without an account. Creating an account starts fresh — demo work
          is not copied over.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/signup" className="rounded-md bg-rw-ink px-3 py-1.5 text-sm font-semibold text-white">
            Create a free account
          </Link>
          <button
            type="button"
            className="text-sm font-semibold underline"
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
