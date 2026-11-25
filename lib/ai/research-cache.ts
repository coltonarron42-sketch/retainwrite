/**
 * PC-31 (Colton t213u #1): a dev/test cache for Pau's web-search turns, so repeated test turns reuse results
 * instead of running fresh searches. Never on in production: it's on only when VERCEL_ENV is preview or
 * development (or a local/test run), and PAU_SEARCH_CACHE=0 turns it off anywhere. No DB: process memory plus
 * Vercel's Runtime Cache (per region, ephemeral) on preview deployments.
 * Key: the normalized student message + mode + stage + section + a hash of the paper context.
 */
import { createHash } from "node:crypto";

export type CachedResearch = { text: string; sources: { title: string; url: string }[]; searches: number };

const TTL_S = 7 * 24 * 3600;
const mem = new Map<string, { at: number; v: CachedResearch }>();

export function searchCacheOn(env: Record<string, string | undefined> = process.env): boolean {
  if (env.PAU_SEARCH_CACHE === "0") return false;
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return true;
  // Off Vercel: local dev and tests only (a self-hosted production build has NODE_ENV=production).
  return !env.VERCEL && env.NODE_ENV !== "production";
}

export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function researchCacheKey(p: { message: string; mode: string; stage: number; section?: string; context: string }): string {
  const h = createHash("sha256");
  h.update(JSON.stringify([normalizeQuery(p.message), p.mode, p.stage, normalizeQuery(p.section ?? ""), createHash("sha256").update(p.context).digest("hex")]));
  return `pau-research:v1:${h.digest("hex").slice(0, 40)}`;
}

type RuntimeCache = { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown, o?: { ttl?: number; tags?: string[] }) => Promise<void> };
let runtime: RuntimeCache | null | undefined;
async function runtimeCache(): Promise<RuntimeCache | null> {
  if (runtime !== undefined) return runtime;
  runtime = null;
  if (!process.env.VERCEL) return runtime;
  try {
    const mod = (await import("@vercel/functions")) as { getCache?: (o?: { namespace?: string }) => RuntimeCache };
    runtime = mod.getCache ? mod.getCache({ namespace: "pau-research" }) : null;
  } catch {
    runtime = null;
  }
  return runtime;
}

const valid = (v: unknown): v is CachedResearch =>
  Boolean(v && typeof v === "object" && typeof (v as CachedResearch).text === "string" && Array.isArray((v as CachedResearch).sources));

export async function getCachedResearch(key: string): Promise<CachedResearch | null> {
  const m = mem.get(key);
  if (m && Date.now() - m.at < TTL_S * 1000) return m.v;
  const rc = await runtimeCache();
  if (!rc) return null;
  try {
    const v = await rc.get(key);
    if (valid(v)) {
      mem.set(key, { at: Date.now(), v });
      return v;
    }
  } catch {
    /* cache miss */
  }
  return null;
}

export async function putCachedResearch(key: string, v: CachedResearch): Promise<void> {
  mem.set(key, { at: Date.now(), v });
  if (mem.size > 500) mem.delete(mem.keys().next().value as string);
  const rc = await runtimeCache();
  if (!rc) return;
  try {
    await rc.set(key, v, { ttl: TTL_S, tags: ["pau-research"] });
  } catch {
    /* best effort */
  }
}

/** Tests only. */
export function _clearResearchCache(): void {
  mem.clear();
}
