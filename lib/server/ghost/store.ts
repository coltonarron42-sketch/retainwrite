import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_STRONG } from "@/lib/config";
import {
  GHOST_FIELD,
  ghostInputHash,
  ghostLogDetail,
  ghostPrompt,
  openGhost,
  parseGhost,
  sealGhost,
  type GhostInput,
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

/** Max searches the ghost may use for one paper (Colton t218u: be mindful of search counts). */
export const GHOST_MAX_TURNS = 3;

async function generate(input: GhostInput, inputHash: string): Promise<GhostScript | null> {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return null;
  const { system, user } = ghostPrompt(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150_000);
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_STRONG,
        store: false,
        tools: [{ type: "web_search" }],
        max_turns: GHOST_MAX_TURNS,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ghost_script",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                thesis: { type: "string" },
                outline: { type: "array", items: { type: "object", additionalProperties: false, properties: { section: { type: "string" }, points: { type: "array", items: { type: "string" } } }, required: ["section", "points"] } },
                paper: { type: "string" },
                sources: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"] } },
              },
              required: ["thesis", "outline", "paper", "sources"],
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.warn("[ghost] generate failed", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const searches = (body.output ?? []).filter((o) => o.type === "web_search_call").length;
    const text =
      body.output_text ??
      body.output?.flatMap((o) => (o.type === "message" ? (o.content ?? []) : [])).find((c) => c.type === "output_text")?.text ??
      "";
    return parseGhost(text, { inputHash, startingKind: input.startingKind, searches });
  } catch (e) {
    console.warn("[ghost] generate error", { name: (e as Error)?.name ?? "error" });
    return null;
  } finally {
    clearTimeout(timer);
  }
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
  if (!secret() || !process.env.GROK_API_KEY?.trim()) return "off";
  const inputHash = ghostInputHash(input);
  const existing = await readGhost(supabase, paperId);
  if (existing?.inputHash === inputHash) return "kept";
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
  };
}
