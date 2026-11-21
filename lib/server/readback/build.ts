import "server-only";

import { composeReadback } from "@/lib/drafting/hiddenPlan";
import type { ReadbackFlag } from "@/lib/drafting/readback";
import { guardStudentOutput } from "@/lib/server/hiddenDraft/guard";
import { readHiddenDraftMeta } from "@/lib/server/hiddenDraft/store";

export async function buildStudentReadback(input: {
  paperId: string;
  ideas: { id: string; text: string; sectionKey: string }[];
  labels?: Record<string, string>;
  studentCorpus: string;
}): Promise<{ ideas: { id: string; text: string; sectionKey: string }[]; flags: ReadbackFlag[] }> {
  try {
    const meta = await readHiddenDraftMeta(input.paperId);
    const shaped = composeReadback({
      ideas: input.ideas,
      signals: meta.found ? meta.signals : null,
      labels: input.labels,
      leakOk: true,
    });
    const leak = await guardStudentOutput(input.paperId, JSON.stringify(shaped), input.studentCorpus);
    if (!leak.ok) return { ideas: input.ideas, flags: [] };
    return { ideas: shaped.ideas, flags: shaped.flags.slice(0, 2) };
  } catch {
    return { ideas: input.ideas, flags: [] };
  }
}
