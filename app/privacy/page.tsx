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
          request deletion via support@retainwrite.com. RetainWrite is for people
          13 and older. If you are under 18, a parent or guardian should know
          you are using it.
        </p>
        <h2 className="mt-8 font-display text-2xl text-rw-ink">About your coach</h2>
        <p className="mt-3 text-rw-ink/70">
          To check your paper&apos;s structure, your coach builds a private outline of
          where your ideas could go. You never see it, it&apos;s never part of your
          paper, and it&apos;s deleted 30 days after you finish Drafting.
        </p>
      </article>
    </main>
  );
}
