import type { SaveStatusValue } from "@/lib/papers/use-draft-save";

/**
 * "Saving…" / "Saved". Always one fixed-height line, even when idle, so a draft
 * save never changes the height of the pinned phone composer (QA 4:42 #1).
 */
export function SaveStatus({ status }: { status: SaveStatusValue }) {
  if (status === "idle") return <span aria-hidden className="inline-block h-[20px] align-middle" data-save-status />;
  return (
    <span className="inline-block h-[20px] align-middle text-[13px] leading-[20px] text-ds-muted" role="status" data-save-status>
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
