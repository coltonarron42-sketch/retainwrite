import { SiteHeader } from "@/components/marketing/site-header";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Sign up" };

type Props = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/app";

  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Start free</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          First paper free. No card at signup. Must be 13+. Ages 13–17 need
          guardian confirmation.
        </p>
        <SignupForm nextPath={nextPath} />
      </div>
    </main>
  );
}
