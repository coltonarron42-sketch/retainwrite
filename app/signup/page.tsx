import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { authErrorMessage, safeInternalPath } from "@/lib/auth/site-url";
import { dsError } from "@/lib/ds/classes";

export const metadata = { title: "Sign up" };

type Props = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const nextPath = safeInternalPath(params.next);
  const errorMessage = params.error ? authErrorMessage(params.error) : null;

  return (
    <AuthShell
      title="Start free"
      subtitle="First paper free. No card at signup. Must be 13+."
      notices={
        errorMessage ? (
          <p
            className={`mt-4 rounded-[8px] border border-ds-error bg-ds-surface px-4 py-2 ${dsError}`}
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null
      }
    >
      <SignupForm nextPath={nextPath} />
    </AuthShell>
  );
}
