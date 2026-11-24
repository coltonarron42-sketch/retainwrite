/**
 * THE switch for where Pau Pau's course-material summary comes from when the
 * student hasn't uploaded or pasted the reading (Colton decides; QA 11/23).
 * Uploaded/pasted readings always win, then a long assignment sheet.
 *
 * - "overview":     the assignment names well-known works (a textbook chapter, an
 *                   HBR article…) → a general-knowledge overview of each work,
 *                   labeled "General overview, not your course copy", with
 *                   link-checked sources; nothing named → topic background.
 * - "topic":        topic background only (never describes the named works).
 * - "uploads_only": no summary without their reading; she asks for it instead.
 *
 * Env override (no code change): RW_MATERIAL_POLICY=overview|topic|uploads_only.
 */
export type MaterialPolicy = "overview" | "topic" | "uploads_only";

export const MATERIAL_SOURCE_POLICY: MaterialPolicy = "overview";

export function materialPolicy(): MaterialPolicy {
  const env = process.env.RW_MATERIAL_POLICY?.trim();
  return env === "overview" || env === "topic" || env === "uploads_only" ? env : MATERIAL_SOURCE_POLICY;
}
