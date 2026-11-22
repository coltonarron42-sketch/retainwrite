"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dsBody,
  dsError,
  dsInput,
  dsLabel,
  dsLink,
  dsStatus,
} from "@/lib/ds/classes";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  if (state.notice) {
    return (
      <p className={dsStatus} role="status">
        {state.notice}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label className={dsLabel} htmlFor="email">
          Email
        </Label>
        <Input
          className={dsInput}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      {state.error ? (
        <p className={dsError} role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="ds-btn-primary w-full disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Sending…" : "Email me a reset link"}
      </button>
      <p className={dsBody}>
        Remembered it?{" "}
        <Link href="/login" className={dsLink}>
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    initialState,
  );
  const [show, setShow] = useState(false);
  // Controlled so a failed submit doesn't wipe what the student typed.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatchShown, setMismatchShown] = useState(false);
  const MISMATCH = "The two passwords don't match. Type the same one twice.";
  const matches = password === confirm;
  const serverError =
    state.error && !(state.error === MISMATCH && matches) ? state.error : null;
  const error = mismatchShown && !matches ? MISMATCH : serverError;

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        if (!matches) {
          event.preventDefault();
          setMismatchShown(true);
        }
      }}
    >
      {/* Lets password managers save the new password under this account. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <p className={dsBody}>
        Account: <span className="font-semibold text-ds-ink">{email}</span>
      </p>
      <div className="space-y-2">
        <Label className={dsLabel} htmlFor="password">
          New password
        </Label>
        <Input
          className={dsInput}
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className={dsLabel} htmlFor="confirm_password">
          Type it again
        </Label>
        <Input
          className={dsInput}
          id="confirm_password"
          name="confirm_password"
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-[16px] leading-[1.6] text-ds-muted">
        <input
          type="checkbox"
          className="ds-focus h-4 w-4 accent-[var(--ds-accent)]"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
        Show password
      </label>
      {error ? (
        <p className={dsError} role="alert">
          {error}{" "}
          {error.includes("expired") || error.includes("reset link") ? (
            <Link href="/forgot-password" className={dsLink}>
              Forgot password
            </Link>
          ) : null}
        </p>
      ) : null}
      <button
        type="submit"
        className="ds-btn-primary w-full disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
