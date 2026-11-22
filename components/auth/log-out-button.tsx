"use client";

import { signOutAction } from "@/app/auth/actions";
import { clearAppLocalData, setLocalUser } from "@/lib/local/user-scope";
import { resetChatPrefs } from "@/lib/voice/prefs";
import { stopSpeech } from "@/lib/voice/speech";

/**
 * Server-side sign out: clears the auth cookies and the demo-session cookie,
 * then goes to the home page. Demo sessions show it as "Exit demo". This
 * browser's RetainWrite data (drafts, settings) is removed first.
 */
export function LogOutButton({
  className,
  label = "Log out",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        stopSpeech();
        // No user from here on: late async work (e.g. a prefs fetch still in
        // flight) can no longer write under the old account.
        setLocalUser(null);
        resetChatPrefs();
        clearAppLocalData();
      }}
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
