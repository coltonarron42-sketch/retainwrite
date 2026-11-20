import { SiteHeader } from "@/components/marketing/site-header";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Log in" };

type Props = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/app";

  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Log in</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          Sign in with email and password, or continue in demo mode to walk the
          intake flow without an account.
        </p>
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
