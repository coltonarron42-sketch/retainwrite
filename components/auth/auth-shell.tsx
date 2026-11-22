import { SiteHeader } from "@/components/marketing/site-header";

type Props = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shown between the subtitle and the card (page-level alerts, banners). */
  notices?: React.ReactNode;
  /** Logo-only header (password reset). */
  minimal?: boolean;
  children: React.ReactNode;
};

/** Shared Editorial-Warm frame (PLAN.md 8) for the sign-in pages. */
export function AuthShell({
  title,
  subtitle,
  notices,
  minimal = false,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-ds-page font-ds-sans text-ds-ink">
      <SiteHeader tone="editorial" minimal={minimal} />
      <main className="px-6 py-8 md:px-16 md:py-12">
        <div className="mx-auto max-w-[480px]">
          {title ? (
            <h1 className="font-display text-[32px] font-semibold leading-[1.2] text-ds-ink">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted md:mt-4">
              {subtitle}
            </p>
          ) : null}
          {notices}
          <div className="mt-6 rounded-[12px] border border-ds-border bg-ds-surface p-6 shadow-ds-card md:mt-8 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
