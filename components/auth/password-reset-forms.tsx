"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);
  if (state.notice) {
    return (
      <p className="mt-8 text-sm text-rw-teal" role="status">
        {state.notice}
      </p>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Email me a reset link"}
      </Button>
      <p className="text-sm text-rw-ink/60">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-rw-teal">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(updatePasswordAction, initialState);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-8 space-y-4">
      {/* Lets password managers save the new password under this account. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <p className="text-sm text-rw-ink/70">
        Account: <span className="font-semibold text-rw-ink">{email}</span>
      </p>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Type it again</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-rw-ink/70">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show password
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}{" "}
          {state.error.includes("expired") || state.error.includes("reset link") ? (
            <Link href="/forgot-password" className="font-semibold underline">
              Forgot password
            </Link>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" className="w-full" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
