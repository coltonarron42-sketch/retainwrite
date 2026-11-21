import "server-only";

import { safeHiddenLogDetail } from "@/lib/drafting/hiddenPlan";
import { assertNoHiddenDraftLeak } from "@/lib/drafting/leak";
import { loadHiddenDraftMaterial } from "@/lib/server/hiddenDraft/store";

export async function guardStudentOutput(
  paperId: string,
  output: string,
  studentCorpus: string,
): Promise<{ ok: true } | { ok: false; rule: string }> {
  try {
    const material = await loadHiddenDraftMaterial(paperId);
    if (!material) return { ok: true };
    const leak = assertNoHiddenDraftLeak(output, material.text, studentCorpus, material.canary || undefined);
    if (!leak.ok) {
      console.info("[hidden_draft_leak_blocked]", safeHiddenLogDetail({ surface: "readback", rule: leak.rule }));
    }
    return leak;
  } catch {
    return { ok: false, rule: "guard" };
  }
}
