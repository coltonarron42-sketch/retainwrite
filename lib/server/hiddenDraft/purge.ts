import "server-only";

import { safeHiddenLogDetail } from "@/lib/drafting/hiddenPlan";
import { purgeHiddenDraftRows } from "@/lib/server/hiddenDraft/store";

export async function purgeHiddenDrafts(): Promise<number> {
  try {
    const deleted = await purgeHiddenDraftRows();
    if (deleted > 0) {
      console.info("[hidden_draft_deleted]", safeHiddenLogDetail({ reason: "retention", count: deleted }));
    }
    return deleted;
  } catch {
    console.info("[hidden_draft_failed]", safeHiddenLogDetail({ reason: "store" }));
    return 0;
  }
}
