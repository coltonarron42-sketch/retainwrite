import "server-only";

// SOP: hidden scaffold. Ghost paper #1 (shape) and #2 (basic outline) live in
// private.ghost_shapes, read and written only through service-role functions.
// Routes return projectSkeleton() output: labels, subheadings and short titles only.
import { grokChatJson, hasGrokKey } from "@/lib/ai/grok";
import { MODEL_FAST, MODEL_STRONG } from "@/lib/config";
import { assertNoHiddenDraftLeak } from "@/lib/drafting/leak";
import { loadHiddenDraftMaterial } from "@/lib/server/hiddenDraft/store";
import {
  inputHash,
  OUTLINE_SYSTEM,
  outlineFromModel,
  projectSkeleton,
  ruleOutline,
  ruleShape,
  SHAPE_SYSTEM,
  shapeFromModel,
  type OutlineFacts,
  type PaperShape,
  type ShapeOutline,
  type SkeletonView,
} from "@/lib/skeleton/shape";
import { createServiceRoleClient } from "@/lib/supabase/server";

type GhostRow = { shape: PaperShape | null; shapeHash: string | null; outline: ShapeOutline | null; outlineHash: string | null };

export async function readGhost(paperId: string): Promise<GhostRow | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("get_ghost_shape", { p_paper_id: paperId });
  if (error || !data || typeof data !== "object") return null;
  const row = data as { found?: boolean; shape?: PaperShape | null; shape_hash?: string | null; outline?: ShapeOutline | null; outline_hash?: string | null };
  if (!row.found) return { shape: null, shapeHash: null, outline: null, outlineHash: null };
  return { shape: row.shape ?? null, shapeHash: row.shape_hash ?? null, outline: row.outline ?? null, outlineHash: row.outline_hash ?? null };
}

async function writeGhost(paperId: string, userId: string, kind: "shape" | "outline", data: unknown, hash: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.rpc("upsert_ghost_shape", { p_paper_id: paperId, p_user_id: userId, p_kind: kind, p_data: data, p_hash: hash });
  if (error) throw new Error("ghost store");
}

export async function purgeGhostShapes(): Promise<number> {
  try {
    const service = createServiceRoleClient();
    const { data, error } = await service.rpc("purge_ghost_shapes");
    return error ? 0 : Number(data ?? 0);
  } catch {
    return 0;
  }
}

async function askJson(system: string, user: string, strong: boolean, what: string): Promise<unknown | null> {
  if (!hasGrokKey()) return null;
  // QA 1:11 AM #1: the strong model often needs more than 15 s; give it its normal budget,
  // then one quick try on the fast model before the rules fallback.
  const tries: { model: typeof MODEL_STRONG | typeof MODEL_FAST; timeoutMs: number }[] = strong ? [{ model: MODEL_STRONG, timeoutMs: 30_000 }, { model: MODEL_FAST, timeoutMs: 12_000 }] : [{ model: MODEL_FAST, timeoutMs: 12_000 }];
  for (const t of tries) {
    const res = await grokChatJson({ model: t.model, system, user, reasoningEffort: "low", timeoutMs: t.timeoutMs });
    if (!res.ok) {
      console.warn(`[ghost] ${what} model miss`, t.model === MODEL_STRONG ? "strong" : "fast", "reason" in res ? res.reason : "");
      continue;
    }
    try {
      return JSON.parse(res.text) as unknown;
    } catch {
      console.warn(`[ghost] ${what} bad json`);
    }
  }
  return null;
}

/** Ghost #1: the shape, once the assignment (and any material) has been read. */
export async function ensureShape(input: {
  paperId: string;
  userId: string;
  assignmentText: string;
  words: number | null;
  material: string;
  existing: GhostRow | null;
}): Promise<PaperShape> {
  // Only a new assignment re-plans the shape; material read later doesn't reshuffle the skeleton.
  // A rules fallback (the model missed) is retried on the next ask, never kept for good.
  const hash = `a:${inputHash(input.assignmentText)}`;
  if (input.existing?.shape && input.existing.shapeHash === hash && input.existing.shape.source === "model") return input.existing.shape;
  const raw = await askJson(
    SHAPE_SYSTEM,
    JSON.stringify({ assignment: input.assignmentText.slice(0, 8000), target_words: input.words, course_material: input.material.slice(0, 4000) }),
    true,
    "shape",
  );
  const fromModel = raw ? shapeFromModel(raw) : null;
  if (raw && !fromModel) console.warn("[ghost] shape rejected by schema");
  const shape = fromModel ?? ruleShape({ text: input.assignmentText, words: input.words });
  await writeGhost(input.paperId, input.userId, "shape", shape, hash).catch(() => undefined);
  return shape;
}

/** Ghost #2: short body titles from the student's choices (leader, styles) and, later, their notes. */
export async function ensureOutline(input: {
  paperId: string;
  userId: string;
  shape: PaperShape;
  facts: OutlineFacts;
  choices: string[];
  bodyNotes: string[];
  existing: GhostRow | null;
}): Promise<ShapeOutline | null> {
  const studentCorpus = [...input.choices, ...input.bodyNotes].join("\n");
  if (!input.facts.leader && !input.facts.styles.length && !input.bodyNotes.length) return input.existing?.outline ?? null;
  const hash = `${inputHash(input.shape.blocks.map((b) => b.key).join(","))}:${inputHash(JSON.stringify(input.facts) + studentCorpus)}`;
  if (input.existing?.outline && input.existing.outlineHash === hash) return input.existing.outline;
  const raw = await askJson(
    OUTLINE_SYSTEM,
    JSON.stringify({
      body_paragraphs: input.shape.blocks.filter((b) => b.group === "body").map((b) => b.sub),
      leader: input.facts.leader,
      styles: input.facts.styles,
      student_choices: input.choices.map((c) => c.slice(0, 600)),
      student_body_notes: input.bodyNotes.map((n, i) => ({ i, note: n.slice(0, 600) })),
    }),
    false,
    "outline",
  );
  let outline = (raw ? outlineFromModel(raw, input.shape, input.bodyNotes.length, input.facts) : null) ?? ruleOutline(input.shape, input.facts);
  // Same leak guard as the hidden draft: a title may not carry hidden-draft wording.
  const hidden = await loadHiddenDraftMaterial(input.paperId).catch(() => null);
  if (hidden) {
    const leak = assertNoHiddenDraftLeak(outline.titles.map((t) => t.title).join(". "), hidden.text, studentCorpus, hidden.canary || undefined);
    if (!leak.ok) outline = ruleOutline(input.shape, input.facts);
  }
  await writeGhost(input.paperId, input.userId, "outline", outline, hash).catch(() => undefined);
  return outline;
}

export function viewFor(shape: PaperShape, outline: ShapeOutline | null): SkeletonView {
  return projectSkeleton(shape, outline);
}

/** Server-side only: the decisions the shape says Pau needs (for her prompts). */
export function shapeDecisionsBlock(shape: PaperShape | null): string {
  if (!shape) return "";
  const body = shape.blocks.filter((b) => b.group === "body").length;
  const d = shape.decisions.length ? ` Decisions still needed from the student: ${shape.decisions.join(" ")}` : "";
  return `Paper shape: ${body} body paragraphs (${shape.blocks.filter((b) => b.group === "body").map((b) => b.sub).join("; ")}).${d}`;
}
