import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-md border border-rw-ink/15 bg-white/80 px-3 py-2 text-sm text-rw-ink shadow-sm placeholder:text-rw-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rw-teal disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
