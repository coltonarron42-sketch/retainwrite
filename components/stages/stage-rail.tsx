import Link from "next/link";
import { Lock, Check } from "lucide-react";
import { STAGE_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";

type Props = {
  paperId: string;
  current: number;
  statuses: Record<number, "locked" | "in_progress" | "complete">;
};

export function StageRail({ paperId, current, statuses }: Props) {
  return (
    <nav
      aria-label="Stages"
      className="w-full shrink-0 border-b border-ds-border p-4 font-ds-sans md:w-60 md:border-b-0 md:border-r md:px-6 md:py-12"
    >
      <p className="text-[13px] font-semibold uppercase tracking-wider text-ds-muted">
        Six-stage coach
      </p>
      <ol className="mt-4 space-y-1">
        {STAGE_LABELS.map((label, idx) => {
          const stage = idx + 1;
          const active = stage === current;
          const saved = statuses[stage] ?? "locked";
          const status = active && saved === "locked" ? "in_progress" : saved;
          const unlocked = status !== "locked";
          const content = (
            <span
              className={cn(
                "flex items-center gap-2 rounded-[8px] px-2 py-2 text-[16px] transition-colors duration-150",
                active && "bg-ds-surface font-semibold text-ds-ink shadow-ds-card",
                !active && unlocked && "text-ds-ink hover:bg-ds-surface",
                !unlocked && "text-ds-faint",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[13px]",
                  active
                    ? "border-ds-accent bg-ds-accent text-white"
                    : status === "complete"
                      ? "border-ds-sage text-ds-sage"
                      : "border-current",
                )}
              >
                {status === "complete" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : status === "locked" ? (
                  <Lock className="h-3 w-3" aria-hidden />
                ) : (
                  stage
                )}
              </span>
              {label}
            </span>
          );
          return (
            <li key={label}>
              {unlocked ? (
                <Link
                  href={`/app/papers/${paperId}/stage/${stage}`}
                  aria-current={active ? "step" : undefined}
                  className="ds-focus block rounded-[8px]"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
