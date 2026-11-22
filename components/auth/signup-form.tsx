"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/app/auth/actions";
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

type Props = {
  nextPath?: string;
};

export function SignupForm({ nextPath = "/app" }: Props) {
  const [signUpState, signUp, signUpPending] = useActionState(
    signUpAction,
    initialState,
  );
  const error = signUpState.error;
  const notice = signUpState.notice;
  const pending = signUpPending;

  if (signUpState.notice) {
    return (
      <div className="space-y-4">
        <p className={dsStatus} role="status">
          {signUpState.notice}
        </p>
        <p className={dsBody}>
          Open the email and click the link. You will land in RetainWrite
          already signed in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={signUp} className="space-y-4">
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
            required
            autoComplete="email"
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
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <label className="flex items-start gap-2 text-[16px] leading-[1.6] text-ds-muted">
          <input
            type="checkbox"
            required
            className="ds-focus mt-[6px] h-4 w-4 accent-[var(--ds-accent)]"
            name="agree"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className={dsLink}>
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={dsLink}>
              Privacy Policy
            </Link>
            . I confirm I am 13 or older.
          </span>
        </label>
        <p className={dsBody}>
          If you&apos;re under 18, please make sure a parent or guardian knows
          you&apos;re using RetainWrite.
        </p>
        {error ? (
          <p className={dsError} role="alert">
            {error}{" "}
            {error.includes("already exists") ? (
              <>
                <Link href="/login" className={dsLink}>
                  Log in
                </Link>{" "}
                ·{" "}
                <Link href="/forgot-password" className={dsLink}>
                  Reset password
                </Link>
              </>
            ) : null}
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
          {signUpPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className={dsBody}>
        Already have an account?{" "}
        <Link href="/login" className={dsLink}>
          Log in
        </Link>
      </p>
    </div>
  );
}
