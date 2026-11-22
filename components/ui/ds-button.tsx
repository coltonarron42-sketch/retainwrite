import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PLAN.md 8.4 buttons for pages on the Editorial-Warm system.
 * - primary: terracotta, one per screen (the main action)
 * - secondary: white with terracotta border
 * - ghost: text only
 * `size="sm"` is for small row actions. Terracotta text below 19px bold fails
 * AA (8.7), so small secondary/ghost buttons use ink text instead.
 */
type Variant = "primary" | "secondary" | "ghost";
type Size = "default" | "sm";

export interface DsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const SMALL: Record<Variant, string> = {
  primary:
    "ds-focus inline-flex min-h-[40px] items-center justify-center rounded-[8px] bg-ds-ink px-4 text-[16px] font-semibold text-white transition-colors duration-150 hover:bg-ds-muted",
  secondary:
    "ds-focus inline-flex min-h-[40px] items-center justify-center rounded-[8px] border border-ds-border bg-ds-surface px-4 text-[16px] font-semibold text-ds-ink transition-colors duration-150 hover:border-ds-accent",
  ghost:
    "ds-focus inline-flex min-h-[40px] items-center justify-center rounded-[8px] px-2 text-[16px] font-semibold text-ds-muted underline-offset-4 transition-colors duration-150 hover:text-ds-ink hover:underline",
};

export const DsButton = React.forwardRef<HTMLButtonElement, DsButtonProps>(
  ({ className, variant = "primary", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        size === "sm" ? SMALL[variant] : `ds-btn-${variant}`,
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        className,
      )}
      {...props}
    />
  ),
);
DsButton.displayName = "DsButton";
