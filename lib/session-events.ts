/**
 * SOP session logging — ids, counts, enums only. Never full assignment text.
 */

import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function logSessionEvent(input: {
  paperId?: string;
  stage: number;
  event: string;
  detail?: Record<string, string | number | boolean | null>;
}) {
  try {
    const demo = await getDemoSession();
    if (demo || !hasSupabaseConfig()) {
      // Demo / local: no durable store yet
      return;
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("session_events").insert({
      user_id: user.id,
      paper_id: input.paperId ?? null,
      stage: input.stage,
      event: input.event,
      detail: input.detail ?? {},
    });
  } catch {
    /* never block the student on logging */
  }
}
