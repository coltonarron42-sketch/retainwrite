import Link from "next/link";
import { STAGE_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";

type Props = {
  paperId: string;
  current: number;
  statuses: Record<number, "locked" | "in_progress" | "complete">;
};

/**
 * Slim horizontal progress inside a paper (PLAN.md 9 and 8.4): six thin
 * markers and the current stage name, one short row that never pushes the chat
 * input down. Done and open stages are links (48px tall hit areas).
 */
export function StageProgress({ paperId, current, statuses }: Props) {
  const total = STAGE_LABELS.length;
  const label = STAGE_LABELS[current - 1] ?? "";
  return (
    <nav aria-label="Stages" className="font-ds-sans" data-stage-progress>
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-[13px] leading-[1.2] text-ds-muted">
          <span className="font-semibold text-ds-ink">{label}</span>
          <span aria-hidden> · </span>
          <span>
            Stage {current} of {total}
          </span>
        </p>
        <ol className="flex min-w-0 flex-1 items-center gap-1">
          {STAGE_LABELS.map((name, idx) => {
            const stage = idx + 1;
            const active = stage === current;
            const saved = statuses[stage] ?? "locked";
            const status = active && saved === "locked" ? "in_progress" : saved;
            const unlocked = status !== "locked";
            const state = active ? "current" : status === "complete" ? "done" : unlocked ? "open" : "locked";
            const bar = (
              <span
                aria-hidden
                className={cn(
                  "block h-1 w-full rounded-full transition-colors duration-150",
                  state === "current" && "bg-ds-accent",
                  state === "done" && "bg-ds-sage",
                  state === "open" && "bg-ds-sage/40",
                  state === "locked" && "bg-ds-border",
                )}
              />
            );
            const srText = `Stage ${stage}: ${name}${active ? " (current)" : status === "complete" ? " (done)" : unlocked ? "" : " (locked)"}`;
            return (
              <li key={name} className="min-w-0 flex-1">
                {/* Done stages open read-only; later ones open a soft-gate look (gates stay on the server). */}
                {!active ? (
                  <Link
                    href={`/app/papers/${paperId}/stage/${stage}`}
                    className="ds-focus flex min-h-[48px] items-center rounded-[8px]"
                    title={name}
                  >
                    {bar}
                    <span className="sr-only">{srText}</span>
                  </Link>
                ) : (
                  <span
                    className="flex min-h-[48px] items-center"
                    aria-current={active ? "step" : undefined}
                    title={name}
                  >
                    {bar}
                    <span className="sr-only">{srText}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
