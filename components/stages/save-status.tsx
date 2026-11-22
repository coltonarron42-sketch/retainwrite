import type { SaveStatusValue } from "@/lib/papers/use-draft-save";

export function SaveStatus({ status }: { status: SaveStatusValue }) {
  if (status === "idle") return null;
  return (
    <span className="text-[13px] text-ds-muted" role="status">
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
