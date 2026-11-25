import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_FAST } from "@/lib/config";
import { grokChatJson } from "@/lib/ai/grok";
import {
  GHOST_FIELD,
  assembleGhost,
  ghostInputHash,
  ghostLogDetail,
  ghostPlanPrompt,
  ghostSectionPrompt,
  ghostTargets,
  openGhost,
  parseGhostPlan,
  parseSection,
  sealGhost,
  sectionsToFix,
  type GhostInput,
  type GhostPlan,
  type GhostScript,
} from "@/lib/ghost/script";

/**
 * Ghost script storage and generation (Colton t221u; PC-32). Server-only. The row lives in
 * paper_autosaves (existing table, no migration) under a reserved "server:" key, encrypted with a
 * key derived from the server's Supabase service secret, so it is opaque even to the student's own
 * RLS read. Nothing here returns ghost text to a route; callers get guidance strings or a gate.
 * // SOP: coaching only, never generate submission text (never shown, never exported)
 */
function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

export async function readGhost(supabase: SupabaseClient, paperId: string): Promise<GhostScript | null> {
  try {
    const { data } = await supabase.from("paper_autosaves").select("draft_text").eq("paper_id", paperId).eq("field_key", GHOST_FIELD).maybeSingle();
    return openGhost(data?.draft_text ?? null, secret());
  } catch {
    return null;
  }
}

async function writeGhost(supabase: SupabaseClient, paperId: string, userId: string, ghost: GhostScript): Promise<boolean> {
  const { error } = await supabase.from("paper_autosaves").upsert(
    { paper_id: paperId, user_id: userId, field_key: GHOST_FIELD, draft_text: sealGhost(ghost, secret()), submitted: false, updated_at: new Date().toISOString() },
    { onConflict: "paper_id,field_key" },
  );
  return !error;
}

const PENDING_FIELD = "server:ghost_pending";
const PENDING_MS = 5 * 60_000;
const MAX_TRIES = 3;

/**
 * One generation at a time per paper, at most MAX_TRIES ever (each try may search the web):
 * a server-only marker row holds the try count and when the last one started.
 */
async function claimTry(supabase: SupabaseClient, paperId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from("paper_autosaves").select("draft_text, updated_at").eq("paper_id", paperId).eq("field_key", PENDING_FIELD).maybeSingle();
  const tries = Number(data?.draft_text ?? 0) || 0;
  const recent = data?.updated_at ? Date.now() - new Date(data.updated_at as string).getTime() < PENDING_MS : false;
  if (tries >= MAX_TRIES || recent) return false;
  const { error } = await supabase.from("paper_autosaves").upsert(
    { paper_id: paperId, user_id: userId, field_key: PENDING_FIELD, draft_text: String(tries + 1), submitted: false, updated_at: new Date().toISOString() },
    { onConflict: "paper_id,field_key" },
  );
  return !error;
}

/** Max searches the ghost may use for one paper (Colton t218u: be mindful of search counts). */
export const GHOST_MAX_TURNS = 3;

/** Step 1: research (≤ GHOST_MAX_TURNS searches) and a section plan with word budgets. */
async function plan(input: GhostInput): Promise<{ plan: GhostPlan; searches: number } | null> {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return null;
  const { system, user } = ghostPlanPrompt(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        store: false,
        tools: [{ type: "web_search" }],
        max_turns: GHOST_MAX_TURNS,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[ghost] plan failed", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const searches = (body.output ?? []).filter((o) => o.type === "web_search_call").length;
    const text =
      body.output_text ??
      body.output?.flatMap((o) => (o.type === "message" ? (o.content ?? []) : [])).find((c) => c.type === "output_text")?.text ??
      "";
    const parsed = parseGhostPlan(text, input);
    return parsed ? { plan: parsed, searches } : null;
  } catch (e) {
    console.warn("[ghost] plan error", { name: (e as Error)?.name ?? "error" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Step 2: one section to its budget (no search). */
async function section(input: GhostInput, p: GhostPlan, i: number, opts: { have?: string; target?: number } = {}): Promise<string | null> {
  const { system, user } = ghostSectionPrompt(input, p, i, opts);
  const r = await grokChatJson({
    model: MODEL_FAST,
    system,
    user,
    jsonSchema: { name: "ghost_section", schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] } },
    timeoutMs: 75_000,
  });
  return r.ok ? parseSection(r.text) : null;
}

/**
 * The full paper, section by section, to the instructor's word range (Colton 4:10 PM: "meet the
 * instructor's requirements"). Searches happen only in the plan step. Runs in the background.
 */
async function generate(input: GhostInput, inputHash: string): Promise<GhostScript | null> {
  const started = Date.now();
  const planned = await plan(input);
  if (!planned) return null;
  const p = planned.plan;
  const written = await Promise.all(p.outline.map((_, i) => section(input, p, i)));
  if (written.some((t) => !t)) {
    // One retry for any section that failed.
    await Promise.all(written.map(async (t, i) => (t ? null : (written[i] = await section(input, p, i)))));
  }
  if (written.some((t) => !t)) return null;
  const texts = written as string[];
  // Up to two passes that bring the total into the range.
  for (let pass = 0; pass < 2 && Date.now() - started < 520_000; pass++) {
    const fixes = sectionsToFix(p.outline.map((x) => x.words), texts, input.targetMin, input.targetMax);
    if (!fixes.length) break;
    await Promise.all(
      fixes.map(async ({ i, target }) => {
        const t = await section(input, p, i, { have: texts[i], target });
        if (t) texts[i] = t;
      }),
    );
  }
  return assembleGhost(p, texts, { inputHash, startingKind: input.startingKind, searches: planned.searches, targetMin: input.targetMin, targetMax: input.targetMax });
}

/**
 * Build (or keep) the ghost for this paper. Same input → no new generation (no new searches).
 * Runs in after(): never blocks the student. Logs counts only.
 */
export async function ensureGhostScript(
  supabase: SupabaseClient,
  paperId: string,
  userId: string,
  input: GhostInput,
  reason: string,
): Promise<"kept" | "stored" | "failed" | "off"> {
  if (!secret() || !process.env.GROK_API_KEY?.trim()) {
    console.info("[ghost]", { reason, status: "off", secret: Boolean(secret()), model: Boolean(process.env.GROK_API_KEY?.trim()) });
    return "off";
  }
  const inputHash = ghostInputHash(input);
  const existing = await readGhost(supabase, paperId);
  if (existing?.inputHash === inputHash) return "kept";
  if (!(await claimTry(supabase, paperId, userId))) {
    console.info("[ghost]", { reason, status: "busy_or_capped" });
    return "failed";
  }
  const started = Date.now();
  const ghost = await generate(input, inputHash);
  if (!ghost) {
    console.info("[ghost]", { reason, status: "failed", ms: Date.now() - started });
    return "failed";
  }
  const ok = await writeGhost(supabase, paperId, userId, ghost);
  console.info("[ghost]", { reason, status: ok ? "stored" : "write_failed", ms: Date.now() - started, ...ghostLogDetail(ghost) });
  return ok ? "stored" : "failed";
}

/**
 * Stage 2-3 backfill: a paper whose ghost isn't there yet (generation failed or timed out, or the
 * paper finished Stage 1 before PC-32) gets one built in the background. Same caps as above.
 */
export async function backfillGhost(supabase: SupabaseClient, paperId: string, userId: string): Promise<void> {
  try {
    const [{ readPaperContext }, { data: asg }] = await Promise.all([
      import("@/lib/server/paper-context/store"),
      supabase.from("assignments").select("requirements").eq("paper_id", paperId).maybeSingle(),
    ]);
    const pctx = await readPaperContext(supabase, paperId);
    if (!pctx.readback?.confirmed) return;
    await ensureGhostScript(supabase, paperId, userId, await ghostInputFor(supabase, paperId, pctx, asg?.requirements ?? null), "stage2_backfill");
  } catch (e) {
    console.warn("[ghost] backfill error", { name: (e as Error)?.name ?? "error" });
  }
}

/** What the ghost is built from: the assignment, the confirmed read-back, material summaries and their starting point. */
export async function ghostInputFor(
  supabase: SupabaseClient,
  paperId: string,
  pctx: import("@/lib/stage1/paper-context").PaperContext,
  requirements: unknown,
): Promise<GhostInput> {
  const { data: asg } = await supabase.from("assignments").select("raw_text").eq("paper_id", paperId).maybeSingle();
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
  const rb = pctx.readback;
  const sp = pctx.startingPoint;
  return {
    assignment: clip(String(asg?.raw_text ?? ""), 8000),
    requirements: clip(JSON.stringify(requirements ?? {}), 4000),
    readback: rb ? clip([rb.ask, rb.mustInclude.length ? `Must include: ${rb.mustInclude.join("; ")}` : "", rb.graded.length ? `Graded on: ${rb.graded.join("; ")}` : ""].filter(Boolean).join("\n"), 2000) : "",
    material: clip((pctx.summaries ?? []).map((s) => `${s.title}: ${s.points.join(" | ")}`).join("\n"), 3000),
    direction: sp?.kind === "has_ideas" ? clip([sp.ideas, sp.followUp].filter(Boolean).join(" "), 1500) : "",
    startingKind: sp?.kind ?? "no_clue",
    ...(({ min, max }) => ({ targetMin: min, targetMax: max }))(ghostTargets((requirements as { length?: { value?: Parameters<typeof ghostTargets>[0] } } | null)?.length?.value)),
  };
}
