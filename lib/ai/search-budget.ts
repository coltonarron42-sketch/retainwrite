/**
 * PC-31 (Colton t218u): a per-paper soft budget for Pau's web searches, so one paper (a test paper or a
 * student's) never runs anything like 25 searches. The per-turn cap stays (2 on a research turn, 3 on a
 * reading turn, never more than 3).
 * - Under SOFT: a turn gets its normal cap.
 * - From SOFT to HARD: one search per turn.
 * - At HARD: no more web searches on this paper; Pau answers without them (labeled as general background).
 * No DB: process memory plus Vercel's Runtime Cache keyed by paper id (best effort, 24h window).
 */
export const PAPER_SEARCH_BUDGET = { soft: 8, hard: 12, windowS: 24 * 3600 } as const;

type RuntimeCache = { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown, o?: { ttl?: number; tags?: string[] }) => Promise<void> };
const mem = new Map<string, { at: number; n: number }>();
let runtime: RuntimeCache | null | undefined;
async function runtimeCache(): Promise<RuntimeCache | null> {
  if (runtime !== undefined) return runtime;
  runtime = null;
  if (!process.env.VERCEL) return runtime;
  try {
    const mod = (await import("@vercel/functions")) as { getCache?: (o?: { namespace?: string }) => RuntimeCache };
    runtime = mod.getCache ? mod.getCache({ namespace: "pau-search-budget" }) : null;
  } catch {
    runtime = null;
  }
  return runtime;
}
const key = (paperId: string) => `pau-searches:v1:${paperId}`;

export async function paperSearchesUsed(paperId: string): Promise<number> {
  const m = mem.get(paperId);
  let n = m && Date.now() - m.at < PAPER_SEARCH_BUDGET.windowS * 1000 ? m.n : 0;
  const rc = await runtimeCache();
  if (rc) {
    try {
      const v = (await rc.get(key(paperId))) as { n?: unknown } | null;
      if (v && typeof v.n === "number") n = Math.max(n, v.n);
    } catch {
      /* best effort */
    }
  }
  return n;
}

export async function addPaperSearches(paperId: string, used: number, add: number): Promise<number> {
  const n = used + Math.max(0, add);
  if (add <= 0) return n;
  mem.set(paperId, { at: Date.now(), n });
  if (mem.size > 2000) mem.delete(mem.keys().next().value as string);
  const rc = await runtimeCache();
  if (rc) {
    try {
      await rc.set(key(paperId), { n }, { ttl: PAPER_SEARCH_BUDGET.windowS, tags: ["pau-search-budget"] });
    } catch {
      /* best effort */
    }
  }
  return n;
}

/** How many searches this turn may run, given what the paper has used. 0 means answer without searching. */
export function turnSearchCap(used: number, perTurn: number, b: { soft: number; hard: number } = PAPER_SEARCH_BUDGET): number {
  const cap = Math.min(3, Math.max(0, perTurn));
  if (used >= b.hard) return 0;
  if (used >= b.soft) return Math.min(1, cap);
  return Math.min(cap, b.hard - used);
}

/** Tests only. */
export function _clearSearchBudget(): void {
  mem.clear();
}
