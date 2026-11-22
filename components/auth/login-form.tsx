"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  signInAction,
  startDemoSessionAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dsBody,
  dsCaption,
  dsError,
  dsInput,
  dsLabel,
  dsLink,
  dsStatus,
} from "@/lib/ds/classes";

const initialState: AuthActionState = {};

type Props = {
  nextPath?: string;
  defaultEmail?: string;
};

export function LoginForm({ nextPath = "/app", defaultEmail = "" }: Props) {
  const [signInState, signIn, signInPending] = useActionState(
    signInAction,
    initialState,
  );
  const [demoState, startDemo, demoPending] = useActionState(
    startDemoSessionAction,
    initialState,
  );

  const error = signInState.error ?? demoState.error;
  const notice = signInState.notice ?? demoState.notice;
  const pending = signInPending || demoPending;

  return (
    <div className="space-y-6">
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-2">
          <Label className={dsLabel} htmlFor="email">
            Email
          </Label>
          <Input
            className={dsInput}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={defaultEmail}
            required
          />
        </div>
        <div className="space-y-2">
          <Label className={dsLabel} htmlFor="password">
            Password
          </Label>
          <Input
            className={dsInput}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <p className={dsError} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className={dsStatus} role="status">
            {notice}
          </p>
        ) : null}
        <button
          type="submit"
          className="ds-btn-primary w-full disabled:opacity-60"
          disabled={pending}
        >
          {signInPending ? "Signing in…" : "Log in"}
        </button>
        <p className="text-right text-[16px]">
          <Link href="/forgot-password" className={dsLink}>
            Forgot password?
          </Link>
        </p>
      </form>

      <div className="flex items-center gap-4 text-[13px] uppercase tracking-[0.08em] text-ds-muted">
        <span className="h-px flex-1 bg-ds-border" />
        or
        <span className="h-px flex-1 bg-ds-border" />
      </div>

      <form action={startDemo}>
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="email" value="demo@retainwrite.com" />
        <button
          type="submit"
          className="ds-btn-secondary w-full disabled:opacity-60"
          disabled={pending}
        >
          {demoPending ? "Opening demo…" : "Continue in demo"}
        </button>
        <p className={`mt-2 text-center ${dsCaption}`}>
          Progress won&apos;t be saved. Create a free account to save and resume
          anytime.
        </p>
      </form>

      <p className={dsBody}>
        New here?{" "}
        <Link href="/signup" className={dsLink}>
          Start free
        </Link>
      </p>
    </div>
  );
}
