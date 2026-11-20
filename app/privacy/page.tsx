import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <article className="mx-auto max-w-2xl px-5 pb-20 pt-28 md:px-8">
        <h1 className="font-display text-4xl text-rw-ink">Privacy (DRAFT)</h1>
        <p className="mt-4 text-rw-ink/70">
          We store account details, intake answers, writing samples, drafts,
          style measurements, course materials you upload, and optional
          professor feedback you choose to share. We do not sell your data.
          Course materials are for your personal study only. Professor feedback
          uploads are deleted within 90 days of review (30 if rejected). You can
          request deletion via support@retainwrite.com.
        </p>
      </article>
    </main>
  );
}
