import { SiteHeader } from "@/components/marketing/site-header";
import { SignupForm } from "@/components/auth/signup-form";
import { authErrorMessage, safeInternalPath } from "@/lib/auth/site-url";

export const metadata = { title: "Sign up" };

type Props = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const nextPath = safeInternalPath(params.next);
  const errorMessage = params.error ? authErrorMessage(params.error) : null;

  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Start free</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          First paper free. No card at signup. Must be 13+. Ages 13–17 need
          guardian confirmation.
        </p>
        {errorMessage ? (
          <p
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        <SignupForm nextPath={nextPath} />
      </div>
    </main>
  );
}
