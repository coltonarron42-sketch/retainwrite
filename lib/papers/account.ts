import { decidePaperFunding } from "@/lib/papers/funding";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const UNREADABLE_ASSIGNMENT =
  "We couldn't read that. Paste or retype the key details.";

/**
 * Insert a paper for this user when it does not exist yet.
 * A local-only id from an older session can be healed on the first real save.
 */
export async function ensureUserPaper(
  supabase: Supabase,
  userId: string,
  paperId?: string,
  options?: { skipCredits?: boolean },
): Promise<
  | { ok: true; id: string }
  | { ok: false; status: number; error: string }
> {
  if (paperId) {
    const { data: existing } = await supabase
      .from("papers")
      .select("id")
      .eq("id", paperId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.id) return { ok: true, id: existing.id };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("free_paper_used, paper_credits")
    .eq("user_id", userId)
    .maybeSingle();

  const decision = options?.skipCredits
    ? { ok: true as const, isFree: false, fundedBy: null, creditsAfter: Number(profile?.paper_credits ?? 0), freePaperUsed: Boolean(profile?.free_paper_used) }
    : decidePaperFunding({
        free_paper_used: Boolean(profile?.free_paper_used),
        paper_credits: Number(profile?.paper_credits ?? 0),
      });
  if (!decision.ok) {
    return { ok: false, status: 402, error: "Add a paper credit to start another paper." };
  }

  const id = paperId ?? crypto.randomUUID();
  const { error } = await supabase.from("papers").insert({
    id,
    user_id: userId,
    is_free_paper: decision.isFree,
    funded_by: decision.fundedBy,
    audio_unlocked: false,
    current_stage: 1,
  });
  if (error) {
    console.error("[papers] create failed", { code: error.code, message: error.message });
    return { ok: false, status: 500, error: "Could not start the paper. Please try again." };
  }

  if (profile && !options?.skipCredits) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        free_paper_used: decision.freePaperUsed,
        paper_credits: decision.creditsAfter,
      })
      .eq("user_id", userId);
    if (profileError) {
      console.error("[papers] profile update failed", {
        code: profileError.code,
        message: profileError.message,
      });
      const { error: rollbackError } = await supabase.from("papers").delete().eq("id", id).eq("user_id", userId);
      if (rollbackError) {
        console.error("[papers] rollback failed", {
          code: rollbackError.code,
          message: rollbackError.message,
        });
      }
      return { ok: false, status: 500, error: "Could not start the paper. Please try again." };
    }
  }

  return { ok: true, id };
}
