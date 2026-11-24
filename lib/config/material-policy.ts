/**
 * THE switch for where Pau Pau's course-material summary comes from (Colton
 * decides; one place, one value). Uploaded/pasted/photographed/linked readings
 * always come first, then a long assignment sheet.
 *
 * - "smart" (DEFAULT; Colton 11:46 PM, "Pau is smart, not a kind reader. If we
 *   know something, share it; if we don't, figure it out. The investigation
 *   sometimes takes asking."): for each named reading she (1) shares what she
 *   genuinely knows about a well-known work, labeled as her own knowledge (no
 *   quotes, page or chapter details she isn't sure of); (2) looks up where it's
 *   legitimately available and what it costs (web_search; real links/prices
 *   from results only; allowlisted legit sellers/open access, never shady
 *   copies); (3) uses the actual text when she can get it legitimately; (4)
 *   asks, casually, for a PDF, photos, a paste or a link. Unknown/obscure work:
 *   an honest ask, no invented summary. No in-app purchase: outbound links only.
 * - "find_source" (Colton 11:41 PM, "dig deeper, like any person without the info
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
 * Env override (no code change): RW_MATERIAL_POLICY=smart|find_source|overview|topic|uploads_only.
 */
export type MaterialPolicy = "smart" | "find_source" | "overview" | "topic" | "uploads_only";

export const MATERIAL_SOURCE_POLICY: MaterialPolicy = "smart";

export function materialPolicy(): MaterialPolicy {
  const env = process.env.RW_MATERIAL_POLICY?.trim();
  return env === "smart" || env === "find_source" || env === "overview" || env === "topic" || env === "uploads_only" ? env : MATERIAL_SOURCE_POLICY;
}

/** Her ask when a named reading isn't uploaded and she can't find that exact source online (Colton's words). */
export function missingReadingAsk(titles: string[]): string {
  const what = titles.length === 0 ? "the reading" : titles.length === 1 ? titles[0]! : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
  return `Hey, it doesn't look like ${what} ${titles.length > 1 ? "were" : "was"} uploaded, and I can't find ${titles.length > 1 ? "those exact sources" : "that exact source"} online. Can you take photos of ${titles.length > 1 ? "them" : "it"}, copy and paste ${titles.length > 1 ? "them" : "it"}, or send me a link? I want to be on the same page, but without that material I'm just grasping at straws.`;
}

export type Offer = { seller: string; url: string; price?: string | null };

/**
 * Her casual ask for the actual material (Colton's spirit: "dude, if you want to
 * grab the PDF for $79.99 I can read it and help, or just give me what you
 * have… I'm not going to the dark web!"). Links render as cards next to it.
 */
export function smartReadingAsk(items: { title: string; offers: Offer[]; known: boolean }[]): string | null {
  const need = items.filter((i) => i);
  if (!need.length) return null;
  const withPrice = need.flatMap((i) => i.offers.filter((o) => o.price).map((o) => ({ ...o, title: i.title }))).at(0);
  const names = need.map((i) => i.title);
  const what = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const unknown = need.filter((i) => !i.known).map((i) => i.title);
  const buy = withPrice
    ? `If you want to grab ${withPrice.title} (${withPrice.price} at ${withPrice.seller}, link below), I can read it with you and help a ton. `
    : need.some((i) => i.offers.length)
      ? "I found where you can get it legit (links below). "
      : "";
  const honest = unknown.length
    ? `Real talk: I don't know ${unknown.length === 1 ? unknown[0] : "those"} well enough to tell you what ${unknown.length === 1 ? "it says" : "they say"}, and I won't guess. `
    : "";
  return `${honest}I don't have your copy of ${what} yet. ${buy}${buy ? "Or just give me" : "Can you give me"} what you have: a PDF, a photo of each page, a paste, or a link. I need the actual source material, and I'm not going to the dark web!`;
}
