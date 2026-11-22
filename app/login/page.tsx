import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PasswordUpdatedListener } from "@/components/auth/password-updated-listener";
import { authErrorMessage, safeInternalPath } from "@/lib/auth/site-url";
import { dsError } from "@/lib/ds/classes";

export const metadata = { title: "Log in" };

type Props = {
  searchParams?: Promise<{ next?: string; error?: string; email?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const nextPath = safeInternalPath(params.next);
  const errorMessage = params.error ? authErrorMessage(params.error) : null;
  const defaultEmail = (params.email ?? "").trim().slice(0, 254);

  return (
    <AuthShell
      title="Log in"
      subtitle="Log in with your email and password. Or choose Continue in demo to try it without an account."
      notices={
        <>
          {errorMessage ? (
            <p
              className={`mt-4 rounded-[8px] border border-ds-error bg-ds-surface px-4 py-2 ${dsError}`}
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
          <PasswordUpdatedListener />
        </>
      }
    >
      <LoginForm nextPath={nextPath} defaultEmail={defaultEmail} />
    </AuthShell>
  );
}
