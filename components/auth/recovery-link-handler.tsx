"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { establishRecoverySessionAction } from "@/app/auth/actions";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { parseRecoveryHash, resetErrorMessage } from "@/lib/auth/reset";

export function RecoveryLinkHandler({ queryError }: { queryError: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(queryError);
  const started = useRef(false);

  useEffect(() => {
    if (queryError || started.current) return;
    started.current = true;
    const parsed = parseRecoveryHash(window.location.hash);
    // Keep tokens out of history and screenshots.
    window.history.replaceState(null, "", window.location.pathname);
    if (parsed.kind === "error") {
      setError(parsed.code);
      return;
    }
    if (parsed.kind === "none") {
      setError("missing_token");
      return;
    }
    establishRecoverySessionAction(parsed.accessToken, parsed.refreshToken)
      .then((result) => {
        if (result.ok) router.replace("/reset-password");
        else setError("session_failed");
      })
      .catch(() => setError("session_failed"));
  }, [queryError, router]);

  if (!error) {
    return (
      <>
        <h1 className="font-display text-4xl text-rw-ink">Opening your reset link…</h1>
        <p className="mt-3 text-sm text-rw-ink/65" role="status">
          One moment while we sign you in.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-4xl text-rw-ink">Send a new reset link</h1>
      <p className="mt-3 text-sm text-red-700" role="alert">
        {resetErrorMessage(error)}
      </p>
      <ForgotPasswordForm />
    </>
  );
}
