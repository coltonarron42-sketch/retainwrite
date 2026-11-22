"use client";

import { setLocalUser } from "@/lib/local/user-scope";

/**
 * Sets whose browser storage the app reads and writes. Runs during render,
 * before any child page reads storage.
 */
export function LocalUserScope({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  setLocalUser(userId);
  return <>{children}</>;
}
