"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, startDemoSessionAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

type Props = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/app" }: Props) {
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
    <div className="mt-8 space-y-6">
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm text-rw-teal" role="status">
            {notice}
          </p>
        ) : null}
        <Button type="submit" className="w-full" variant="secondary" disabled={pending}>
          {signInPending ? "Signing in…" : "Log in"}
        </Button>
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="text-rw-teal underline">
            Forgot password?
          </Link>
        </p>
      </form>

      <div className="relative text-center text-xs uppercase tracking-wide text-rw-ink/40">
        <span className="bg-rw-paper px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-rw-ink/10" />
      </div>

      <form action={startDemo}>
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="email" value="demo@retainwrite.com" />
        <Button
          type="submit"
          className="w-full"
          variant="outline"
          disabled={pending}
        >
          {demoPending ? "Opening demo…" : "Continue in demo mode"}
        </Button>
        <p className="mt-2 text-center text-xs text-rw-ink/50">
          Skips account creation and opens the intake flow with a local demo
          session.
        </p>
      </form>

      <p className="text-sm text-rw-ink/60">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-rw-teal">
          Start free
        </Link>
      </p>
    </div>
  );
}
