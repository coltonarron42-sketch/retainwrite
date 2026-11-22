import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { RecoveryLinkHandler } from "@/components/auth/recovery-link-handler";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token_hash?: string;
    type?: string;
    error_code?: string;
    error?: string;
  }>;
};

/** Landing page for reset links. Tokens arrive in the URL fragment, which only the browser can read. */
export default async function ResetLinkPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  if (params.token_hash) {
    const qs = new URLSearchParams({
      token_hash: params.token_hash,
      type: params.type || "recovery",
      next: "/reset-password",
    });
    redirect(`/auth/confirm?${qs.toString()}`);
  }
  const queryError = params.error_code || params.error || null;

  return (
    <div className="min-h-screen bg-ds-page font-ds-sans text-ds-ink">
      <SiteHeader tone="editorial" />
      <main className="px-6 py-12 md:px-16">
        <div className="mx-auto max-w-[480px]">
          <RecoveryLinkHandler queryError={queryError} />
        </div>
      </main>
    </div>
  );
}
