import { SiteHeader } from "@/components/marketing/site-header";
import { LoginForm } from "@/components/auth/login-form";
import { authErrorMessage, safeInternalPath } from "@/lib/auth/site-url";

export const metadata = { title: "Log in" };

type Props = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const nextPath = safeInternalPath(params.next);
  const errorMessage = params.error ? authErrorMessage(params.error) : null;

  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Log in</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          Sign in with email and password, or continue in demo mode to walk the
          intake flow without an account.
        </p>
        {errorMessage ? (
          <p
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
