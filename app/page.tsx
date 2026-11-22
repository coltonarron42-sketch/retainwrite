import { HomeEditorial } from "@/components/marketing/home-editorial";
import { SiteHeader } from "@/components/marketing/site-header";
import { isSignedIn } from "@/lib/auth/current-user";

export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <div className="min-h-screen bg-ds-page font-ds-sans text-ds-ink">
      <SiteHeader tone="editorial" />
      <main>
        <HomeEditorial startHref={signedIn ? "/app/papers/new" : "/signup"} />
      </main>
      <footer className="border-t border-ds-border px-6 py-12 text-[13px] leading-[1.6] text-ds-muted md:px-16">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">
            RetainWrite
          </p>
          <div className="flex gap-4">
            <a href="/terms" className="ds-focus rounded-[8px] transition-colors duration-150 hover:text-ds-ink">
              Terms
            </a>
            <a href="/privacy" className="ds-focus rounded-[8px] transition-colors duration-150 hover:text-ds-ink">
              Privacy
            </a>
            <a href="/pricing" className="ds-focus rounded-[8px] transition-colors duration-150 hover:text-ds-ink">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
