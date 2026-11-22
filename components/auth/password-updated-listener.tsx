"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onPasswordUpdated } from "@/lib/auth/password-updated-signal";

/**
 * Shown on /login and /forgot-password. When the student finishes a reset in
 * another tab of this browser, tell them here and get the login form ready.
 */
export function PasswordUpdatedListener({ showLoginLink = false }: { showLoginLink?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(
    () =>
      onPasswordUpdated((signal) => {
        setEmail(signal.email);
        const input = document.getElementById("email") as HTMLInputElement | null;
        if (input) {
          if (!input.value) input.value = signal.email;
          const password = document.getElementById("password") as HTMLInputElement | null;
          (password && input.value ? password : input).focus();
        }
      }),
    [],
  );

  if (!email) return null;
  return (
    <p
      className="mt-4 rounded-md border border-rw-teal/30 bg-white/70 px-3 py-2 text-sm text-rw-teal"
      role="status"
      data-testid="password-updated-banner"
    >
      Password updated. Log in with your new password.{" "}
      {showLoginLink ? (
        <Link href={`/login?email=${encodeURIComponent(email)}`} className="font-semibold underline">
          Log in
        </Link>
      ) : null}
    </p>
  );
}
