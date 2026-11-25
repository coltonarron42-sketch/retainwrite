import type { ReactNode } from "react";
import { PauPauAvatar } from "@/components/stages/stage1/pau-pau-confirm";
import { COACH_NAME } from "@/lib/stage1/pau-pau";
import { cn } from "@/lib/utils";

/** "Pau · {label}" with the small avatar, in place of a plain eyebrow. */
export function CoachEyebrow({ label, className }: { label?: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ds-muted", className)}>
      <PauPauAvatar size="sm" />
      <span>
        {COACH_NAME}
        {label ? <span className="font-normal normal-case tracking-normal"> · {label}</span> : null}
      </span>
    </p>
  );
}

/** A line in Pau's voice: avatar plus a speech bubble. */
export function CoachSays({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)}>
      <PauPauAvatar />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-ds-muted">{COACH_NAME}</p>
        <div className="mt-1 pt-1 text-[16px] leading-[1.6] text-ds-ink">
          {children}
        </div>
      </div>
    </div>
  );
}
