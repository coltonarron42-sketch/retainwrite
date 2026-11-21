export type PaperFunding =
  | {
      ok: true;
      isFree: boolean;
      fundedBy: "single" | "pack3" | null;
      creditsAfter: number;
      freePaperUsed: true;
    }
  | { ok: false; reason: "payment_required" };

/** First paper is free. Later papers spend a credit. Never invents a purchase. */
export function decidePaperFunding(profile: {
  free_paper_used: boolean;
  paper_credits: number;
}): PaperFunding {
  if (!profile.free_paper_used) {
    return {
      ok: true,
      isFree: true,
      fundedBy: null,
      creditsAfter: profile.paper_credits,
      freePaperUsed: true,
    };
  }
  if (profile.paper_credits > 0) {
    return {
      ok: true,
      isFree: false,
      fundedBy: "single",
      creditsAfter: profile.paper_credits - 1,
      freePaperUsed: true,
    };
  }
  return { ok: false, reason: "payment_required" };
}

/** Postgres `date` only. Unparseable checklist text stays null instead of failing the save. */
export function coerceDueDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}
