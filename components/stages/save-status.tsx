import type { SaveStatusValue } from "@/lib/papers/use-draft-save";

export function SaveStatus({ status }: { status: SaveStatusValue }) {
  if (status === "idle") return null;
  return (
    <span className="text-xs text-rw-ink/45" role="status">
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
