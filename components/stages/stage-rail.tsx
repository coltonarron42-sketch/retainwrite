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
    <aside className="w-full shrink-0 border-b border-rw-ink/10 bg-white/60 p-4 md:w-56 md:border-b-0 md:border-r md:p-6">
      <p className="font-display text-lg text-rw-ink">RetainWrite</p>
      <p className="mt-1 text-xs text-rw-ink/50">Six-stage coach</p>
      <ol className="mt-6 space-y-2">
        {STAGE_LABELS.map((label, idx) => {
          const stage = idx + 1;
          const status = statuses[stage] ?? "locked";
          const unlocked = status !== "locked";
          const active = stage === current;
          const content = (
            <span
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                active && "bg-rw-teal/10 font-semibold text-rw-ink",
                !active && unlocked && "text-rw-ink/80",
                !unlocked && "text-rw-ink/35",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-[11px]">
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
                <Link href={`/app/papers/${paperId}/stage/${stage}`}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
