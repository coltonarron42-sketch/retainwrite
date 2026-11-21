"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, startDemoSessionAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

type Props = {
  nextPath?: string;
};

export function SignupForm({ nextPath = "/app" }: Props) {
  const [signUpState, signUp, signUpPending] = useActionState(
    signUpAction,
    initialState,
  );
  const [demoState, startDemo, demoPending] = useActionState(
    startDemoSessionAction,
    initialState,
  );

  const error = signUpState.error ?? demoState.error;
  const notice = signUpState.notice ?? demoState.notice;
  const pending = signUpPending || demoPending;

  if (signUpState.notice) {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-rw-teal" role="status">
          {signUpState.notice}
        </p>
        <p className="text-sm text-rw-ink/70">
          After you confirm, sign in to start your first paper.
        </p>
        <Link href="/login" className="inline-block font-semibold text-rw-teal">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <form action={signUp} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-rw-ink/70">
          <input type="checkbox" required className="mt-1" name="agree" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            . I confirm I am 13 or older.
          </span>
        </label>
        <p className="text-sm text-rw-ink/70">
          If you&apos;re under 18, please make sure a parent or guardian knows
          you&apos;re using RetainWrite.
        </p>
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
          {signUpPending ? "Creating account…" : "Create account"}
        </Button>
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
          Explore the first-paper intake without creating an account.
        </p>
      </form>

      <p className="text-sm text-rw-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-rw-teal">
          Log in
        </Link>
      </p>
    </div>
  );
}
