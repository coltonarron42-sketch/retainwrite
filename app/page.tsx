import { HomeHero } from "@/components/marketing/home-hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SiteHeader } from "@/components/marketing/site-header";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <HomeHero />
      <HowItWorks />
      <footer className="border-t border-rw-ink/10 bg-rw-paper px-5 py-10 text-sm text-rw-ink/55 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg text-rw-ink">RetainWrite</p>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-rw-ink">
              Terms
            </a>
            <a href="/privacy" className="hover:text-rw-ink">
              Privacy
            </a>
            <a href="/pricing" className="hover:text-rw-ink">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
