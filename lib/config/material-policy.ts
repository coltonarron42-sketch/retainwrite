/**
 * THE switch for where Pau Pau's course-material summary comes from (Colton
 * decides; one place, one value). Uploaded/pasted/photographed/linked readings
 * always come first, then a long assignment sheet.
 *
 * - "find_source" (Colton 11/23, "dig deeper, like any person without the info
 *   needed to be helpful"): for each reading the assignment names, she searches
 *   the web for the actual work (its text, or an authoritative page for that
 *   exact work), fetches it, and summarizes ONLY what that page says, with the
 *   source shown. If she can't get it, she says so warmly and asks for photos,
 *   a paste or a link. Never a summary from guesses or general knowledge of a
 *   reading she doesn't have. General concepts the assignment itself names
 *   (e.g. what "leadership style" means) can still be taught.
 * - "overview":     a labeled general-knowledge overview of the named works
 *                   ("not your course copy") with link-checked sources.
 * - "topic":        topic background only (never describes the named works).
 * - "uploads_only": nothing without their reading; she asks for it.
 *
 * Env override (no code change): RW_MATERIAL_POLICY=find_source|overview|topic|uploads_only.
 */
export type MaterialPolicy = "find_source" | "overview" | "topic" | "uploads_only";

export const MATERIAL_SOURCE_POLICY: MaterialPolicy = "find_source";

export function materialPolicy(): MaterialPolicy {
  const env = process.env.RW_MATERIAL_POLICY?.trim();
  return env === "find_source" || env === "overview" || env === "topic" || env === "uploads_only" ? env : MATERIAL_SOURCE_POLICY;
}

/** Her ask when a named reading isn't uploaded and she can't find that exact source online (Colton's words). */
export function missingReadingAsk(titles: string[]): string {
  const what = titles.length === 0 ? "the reading" : titles.length === 1 ? titles[0]! : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
  return `Hey, it doesn't look like ${what} ${titles.length > 1 ? "were" : "was"} uploaded, and I can't find ${titles.length > 1 ? "those exact sources" : "that exact source"} online. Can you take photos of ${titles.length > 1 ? "them" : "it"}, copy and paste ${titles.length > 1 ? "them" : "it"}, or send me a link? I want to be on the same page, but without that material I'm just grasping at straws.`;
}
