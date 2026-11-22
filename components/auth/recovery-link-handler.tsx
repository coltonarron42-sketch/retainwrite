"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { establishRecoverySessionAction } from "@/app/auth/actions";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { parseRecoveryHash, resetErrorMessage } from "@/lib/auth/reset";
import { dsBody, dsError } from "@/lib/ds/classes";

export function RecoveryLinkHandler({
  queryError,
}: {
  queryError: string | null;
}) {
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
        <h1 className="font-display text-[32px] font-semibold leading-[1.2] text-ds-ink">
          Opening your reset link…
        </h1>
        <p className={`mt-4 ${dsBody}`} role="status">
          One moment while we sign you in.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[32px] font-semibold leading-[1.2] text-ds-ink">
        Send a new reset link
      </h1>
      <p className={`mt-4 ${dsError}`} role="alert">
        {resetErrorMessage(error)}
      </p>
      <div className="mt-8 rounded-[12px] border border-ds-border bg-ds-surface p-8 shadow-ds-card">
        <ForgotPasswordForm />
      </div>
    </>
  );
}
