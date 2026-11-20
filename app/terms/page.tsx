import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <article className="prose prose-neutral mx-auto max-w-2xl px-5 pb-20 pt-28 md:px-8">
        <h1 className="font-display text-4xl text-rw-ink">Terms (DRAFT)</h1>
        <p className="text-rw-ink/70">
          RetainWrite is a writing coach. It asks questions and gives feedback;
          it does not write your paper. You are responsible for academic
          integrity rules at your school. Unused paper credits can be refunded
          within 14 days; used credits and audio add-ons are non-refundable —
          email support@retainwrite.com.
        </p>
      </article>
    </main>
  );
}
