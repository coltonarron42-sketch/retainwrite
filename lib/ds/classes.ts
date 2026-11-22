/**
 * PLAN.md section 8 class recipes for pages moved to the Editorial-Warm system.
 * Values come from the `ds` tokens (tailwind.config.ts / globals.css).
 * Body links use ink + underline: terracotta text on the warm page is 3.2:1,
 * below AA for 16px text (8.7).
 */
export const dsInput =
  "h-12 rounded-[8px] border-ds-border bg-ds-surface px-4 text-[16px] text-ds-ink shadow-none placeholder:text-ds-faint focus-visible:ring-ds-accent focus-visible:ring-offset-2";
export const dsLabel = "text-[16px] font-semibold leading-[1.2] text-ds-ink";
export const dsBody = "text-[16px] leading-[1.6] text-ds-muted";
export const dsCaption = "text-[13px] leading-[1.6] text-ds-muted";
export const dsError = "text-[16px] leading-[1.6] text-ds-error";
export const dsStatus =
  "rounded-[8px] border border-ds-border border-l-4 border-l-ds-sage bg-ds-surface px-4 py-2 text-[16px] leading-[1.6] text-ds-ink";
export const dsLink =
  "ds-focus rounded-[4px] font-semibold text-ds-ink underline underline-offset-4 transition-colors duration-150 hover:text-ds-muted";
