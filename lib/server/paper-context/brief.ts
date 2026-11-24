/**
 * The north-star Stage 1 brief (Colton t161u): the plain-words read-back, a
 * concise material summary, and 2-3 real options to decide between. All of it is
 * Pau Pau's teaching content: never paper text, never a thesis for the student.
 * // SOP: coaching only, never generate submission text
 */
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { wellKnownWork } from "@/lib/stage1/well-known";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { checkLinks } from "@/lib/voice/realtime/links";
import { fetchPageText } from "@/lib/server/paper-context/fetch-page";
import type { Offer } from "@/lib/config/material-policy";
import {
  assignmentOnlyOptions,
  generalOptionsFor,
  cleanOptions,
  cleanPoints,
  optionGrounded,
  type DecisionOption,
  type MaterialKind,
  type MaterialSummary,
  type ReadbackPlain,
  type SourceRef,
} from "@/lib/stage1/paper-context";

const RULES = `You are Pau Pau, a writing coach for students (some are minors). You coach; you never write any part of their paper.
Hard rules: never suggest a thesis, a position, a topic sentence, or any sentence they could put in their paper. Never say what they "should argue". Plain words a 9th grader understands, no jargon (explain any term you must use). Be accurate: use only what the provided text says; if something isn't there, leave it out. Never claim what a numbered chapter of a book contains unless the provided text shows that chapter: chapter contents change between editions.`;

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export type AssignmentBasics = {
  topic: string | null;
  prompt: string | null;
  paperType: string | null;
  rubric: string[];
  structure: string[];
  sources: string | null;
  /** Each named required work ("Chapter 4 of … Northouse…", "'What Makes a Leader?' by Daniel Goleman"). */
  namedWorks: string[];
  length: string | null;
  text: string;
};

function basicsText(a: AssignmentBasics): string {
  return [
    a.paperType ? `Paper type: ${a.paperType}` : null,
    a.topic ? `Topic: ${a.topic}` : null,
    a.prompt ? `Prompt: ${a.prompt}` : null,
    a.length ? `Length: ${a.length}` : null,
    a.structure.length ? `Required parts: ${a.structure.join("; ")}` : null,
    a.sources ? `Sources: ${a.sources}` : null,
    a.rubric.length ? `Rubric criteria: ${a.rubric.join("; ")}` : null,
    a.text ? `Full assignment text:\n"""${clip(a.text, 6000)}"""` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const safe = (s: string) => assertCoachingOnly(s).ok;

export async function generateReadback(a: AssignmentBasics): Promise<ReadbackPlain | null> {
  const r = await grokChatJson({
    model: MODEL_FAST,
    system: `${RULES}\nYou're playing an assignment sheet back to a student in plain words before they start.`,
    user: `${basicsText(a)}\n\nReturn JSON: "ask" = what the assignment actually asks them to do, in 1-2 short plain sentences addressed to "you" (no thesis, no answer); "mustInclude" = 2-4 short phrases: what a strong answer must include (from the sheet); "graded" = 1-4 short phrases: how it's graded (from the rubric or sheet; empty if not stated).`,
    jsonSchema: {
      name: "readback",
      schema: {
        type: "object",
        properties: {
          ask: { type: "string" },
          mustInclude: { type: "array", items: { type: "string" } },
          graded: { type: "array", items: { type: "string" } },
        },
        required: ["ask", "mustInclude", "graded"],
        additionalProperties: false,
      },
    },
    timeoutMs: 9_000,
  });
  if (!r.ok) return null;
  try {
    const o = JSON.parse(r.text) as { ask?: string; mustInclude?: unknown; graded?: unknown };
    const ask = clip(o.ask, 320);
    if (!ask || !safe(ask)) return null;
    return { ask, mustInclude: cleanPoints(o.mustInclude, 4).map((x) => x.replace(/\.$/, "")), graded: cleanPoints(o.graded, 4).map((x) => x.replace(/\.$/, "")) };
  } catch {
    return null;
  }
}

/** Key points from a reading (or the assignment sheet itself), condensed. */
export async function summarizeText(input: { kind: Exclude<MaterialKind, "general" | "overview">; title: string; text: string; ask: string | null; source?: SourceRef }): Promise<MaterialSummary | null> {
  const r = await grokChatJson({
    model: MODEL_FAST,
    system: `${RULES}\nThe student hasn't read the material or doesn't know where to start. Give them the key points so they can engage right away.`,
    user: `${input.ask ? `What the assignment asks: ${input.ask}\n` : ""}${input.kind === "reading" ? `Their course reading "${input.title}":` : input.kind === "found" ? `A page about their assigned reading "${input.title}" (${input.source?.url ?? ""}). Use ONLY what this page says; skip menus, ads and unrelated parts:` : "Their assignment sheet:"}\n"""${clip(input.text, 9000)}"""\n\nReturn JSON "points": 3-6 short, jargon-free key points from THIS text that matter for the assignment (facts, ideas, who/what/why). Each under 30 words. If the text lays out a named list or model (e.g. "five components"), one point names every item of it. No opinions on what they should argue.`,
    jsonSchema: {
      name: "summary",
      schema: { type: "object", properties: { points: { type: "array", items: { type: "string" } } }, required: ["points"], additionalProperties: false },
    },
    timeoutMs: 10_000,
  });
  if (!r.ok) return null;
  try {
    const points = cleanPoints((JSON.parse(r.text) as { points?: unknown }).points, 6);
    return points.length >= 2 ? { kind: input.kind, title: input.title, points, sources: input.source ? [input.source] : [], at: Date.now() } : null;
  } catch {
    return null;
  }
}

/**
 * No reading: from the web, with link-checked sources. With named works (policy
 * "overview") it's a general-knowledge overview of each well-known work, labeled
 * "not your course copy"; otherwise general topic background.
 */
export async function generalBackground(a: AssignmentBasics, ask: string | null, opts: { works?: string[]; avoid?: string[] } = {}): Promise<MaterialSummary | null> {
  const works = (opts.works ?? []).slice(0, 3);
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        store: false,
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "system",
            content: works.length
              ? `${RULES}\nThe student hasn't read the assigned works and doesn't have them here. These are well-known published works: give a general-knowledge overview of what each one says (its main ideas, the named styles, models or examples it uses), confirmed by searching the web. Name the actual ideas (e.g. the specific styles or components), not "the reading discusses leadership". This is background for them to learn from, not text for their paper.`
              : `${RULES}\nThe student has no course reading. Search the web and give general background on the ideas the assignment itself names, so they can engage right away. Name the actual ideas, people and examples.${opts.avoid?.length ? ` You do NOT have the assigned readings (${opts.avoid.map((w) => clip(w, 120)).join("; ")}): never say or imply what those readings say, never attribute anything to them or their authors; explain only the general concepts.` : ""}`,
          },
          {
            role: "user",
            content: works.length
              ? `${ask ? `What the assignment asks: ${ask}\n` : ""}Topic: ${clip(a.topic ?? a.prompt, 300)}\nThe assigned works:\n${works.map((w) => `- ${clip(w, 200)}`).join("\n")}\n\nReturn JSON: "points" = 4-7 short, jargon-free points, each naming which work it's from (e.g. "Northouse Ch. 4: …", "Goleman: …"), covering the key ideas the assignment needs (the specific styles/components/terms, each explained in plain words, plus 1-2 well-known real examples if the works use them), each under 35 words; "sources" = 2-4 real, reputable pages about these works that you actually used (title + full url).`
              : `${ask ? `What the assignment asks: ${ask}\n` : ""}Topic: ${clip(a.topic ?? a.prompt, 300)}\n\nReturn JSON: "points" = 3-6 short, jargon-free background points (the specific ideas, key people or examples, the main sides), each under 30 words; "sources" = 2-3 real, reputable pages you actually used (title + full url).`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "background",
            strict: true,
            schema: {
              type: "object",
              properties: {
                points: { type: "array", items: { type: "string" } },
                sources: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"], additionalProperties: false } },
              },
              required: ["points", "sources"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.warn("[brief] background failed", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const text =
      body.output_text ??
      body.output?.flatMap((o) => (o.type === "message" ? (o.content ?? []) : [])).find((c) => c.type === "output_text")?.text ??
      "";
    const o = JSON.parse(text) as { points?: unknown; sources?: SourceRef[] };
    const points = cleanPoints(o.points, works.length ? 7 : 6);
    if (points.length < 2) return null;
    const sources = (await checkLinks((o.sources ?? []).slice(0, 4).map((s) => ({ title: clip(s.title, 120), url: String(s.url ?? "") })))).map((s) => ({ title: s.title, url: s.url }));
    return {
      kind: works.length ? "overview" : "general",
      title: works.length ? works.map(shortWork).join(" and ") : clip(a.topic ?? a.prompt, 80) || "the topic",
      points,
      sources: sources.slice(0, 4),
      at: Date.now(),
    };
  } catch (e) {
    console.warn("[brief] background error", { message: String((e as Error).message ?? e).slice(0, 120) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Colton's "dig deeper" policy: find the ACTUAL named work online (its text or an
 * authoritative page for that exact work), fetch it ourselves, check the page is
 * about that work, and summarize only what the page says. null = couldn't get it.
 */
export async function findNamedWork(work: string, ask: string | null): Promise<MaterialSummary | null> {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return null;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);
  let cands: { title: string; url: string; author: string; workTitle: string }[] = [];
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        store: false,
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "system",
            content:
              "You find web pages for one specific assigned reading. Search the web. Return only pages that are about THIS exact work (same author and title or chapter): its full text, the publisher's or author's page for it, or a detailed, reputable summary page of that exact work. Never a page about the general topic. If you can't find any, return an empty list. JSON only.",
          },
          {
            role: "user",
            content: `The assigned reading, as the assignment names it: ${clip(work, 300)}\nReturn JSON: "author" = the author's last name; "workTitle" = the exact title of the work, or for a book chapter the chapter's title (as published); "pages" = up to 3 pages (title + full url), best first.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "found",
            strict: true,
            schema: {
              type: "object",
              properties: {
                author: { type: "string" },
                workTitle: { type: "string" },
                pages: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"], additionalProperties: false } },
              },
              required: ["author", "workTitle", "pages"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.warn("[brief] find failed", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const text =
      body.output_text ??
      body.output?.flatMap((o) => (o.type === "message" ? (o.content ?? []) : [])).find((c) => c.type === "output_text")?.text ??
      "";
    const o = JSON.parse(text) as { author?: string; workTitle?: string; pages?: { title: string; url: string }[] };
    cands = (o.pages ?? []).slice(0, 3).map((p) => ({ title: clip(p.title, 160), url: String(p.url ?? ""), author: clip(o.author, 60), workTitle: clip(o.workTitle, 160) }));
  } catch (e) {
    console.warn("[brief] find error", { message: String((e as Error).message ?? e).slice(0, 120) });
    return null;
  } finally {
    clearTimeout(timer);
  }
  // The page has to be about this exact work: its author and most of its title words.
  const named = `${work} ${cands[0]?.workTitle ?? ""}`;
  for (const c of cands) {
    const page = await fetchPageText(c.url);
    if (!page.ok) continue;
    if (!pageIsAboutWork(page.text + " " + page.title, { author: c.author || authorOf(work), title: c.workTitle || titleOf(work) || "", named })) continue;
    const label = shortWork(work);
    const s = await summarizeText({ kind: "found", title: label, text: page.text, ask, source: { title: page.title || c.title, url: page.url } });
    console.info("[brief] found", { ms: Date.now() - started, ok: Boolean(s) });
    if (s) return s;
  }
  console.info("[brief] not found", { ms: Date.now() - started, cands: cands.length });
  return null;
}

export type WorkInvestigation = {
  work: string;
  title: string;
  /** She genuinely knows this work (well-known book, chapter, article). */
  known: boolean;
  /** Her own knowledge of its main ideas (labeled as such; no quotes or page details). */
  knowledge: MaterialSummary | null;
  /** From the actual text, found legitimately online and fetched by us. */
  found: MaterialSummary | null;
  /** Where to get it legitimately (link-checked, allowlisted), price only as search showed it. */
  offers: Offer[];
};

/** Legit sellers and open-access homes only (Colton: never pirate, never shady links). */
const LEGIT = /(^|\.)(amazon\.com|barnesandnoble\.com|bookshop\.org|thriftbooks\.com|abebooks\.com|ebay\.com|chegg\.com|vitalsource\.com|redshelf\.com|play\.google\.com|books\.google\.com|books\.apple\.com|sagepub\.com|us\.sagepub\.com|uk\.sagepub\.com|hbr\.org|store\.hbr\.org|hbsp\.harvard\.edu|pearson\.com|mheducation\.com|wiley\.com|cengage\.com|macmillanlearning\.com|routledge\.com|taylorfrancis\.com|oup\.com|global\.oup\.com|cambridge\.org|penguinrandomhouse\.com|harpercollins\.com|simonandschuster\.com|norton\.com|openstax\.org|gutenberg\.org|archive\.org|jstor\.org|doi\.org|ncbi\.nlm\.nih\.gov|europepmc\.org|scholar\.archive\.org)$/i;
const SHADY = /(libgen|z-lib|zlib|annas-archive|pdfdrive|dokumen\.pub|vdoc\.pub|ebin\.pub|epdf|pdfroom|studocu|coursehero|scribd|docplayer|pdfcoffee|silo\.pub|1lib|b-ok|bookfi|sci-hub|kupdf|idoc\.pub|dl\.|torrent)/i;
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
export function legitHost(u: string, opts: { textPage?: boolean } = {}): boolean {
  const h = hostOf(u);
  if (!h || SHADY.test(h) || SHADY.test(u)) return false;
  return LEGIT.test(h) || (Boolean(opts.textPage) && /\.(edu|gov)$/i.test(h));
}
const PRICE = /^\$\d{1,4}(\.\d{2})?$/;

/**
 * Colton 11:46 PM ("Pau is smart, not a kind reader"): what she knows about the
 * named work, where to get it legitimately and for how much, and the actual text
 * when it's legitimately online. Unknown work: known=false, no summary.
 */
/** "Chapter 4 of our textbook (Northouse…)": the chapter number, when the reading is a chapter of a book. */
export function chapterOf(work: string): string | null {
  return work.match(/\b(?:chapter|ch\.?)\s*(\d{1,2})\b/i)?.[1] ?? null;
}

/** Her knowledge of a chapter reading is about the BOOK: chapter contents change between editions (QA 7:02 AM). */
export function bookLevelTitle(title: string): string {
  return `${title.replace(/,?\s*(?:Ch\.|Chapter)\s*\d+\s*$/i, "").trim()} (the book overall)`;
}

/** A point that claims what a numbered chapter contains. */
export const CHAPTER_CLAIM = /\b(?:chapter|ch\.?)\s*\d{1,2}\b/i;

/** A fetched page verifies a chapter only when it shows that chapter (a table of contents or an excerpt). */
export function pageShowsChapter(page: string, chapter: string): boolean {
  return new RegExp(`\\b(?:chapter|ch\\.?)\\s*${chapter}\\b`, "i").test(page);
}

export async function investigateWork(work: string, ask: string | null): Promise<WorkInvestigation> {
  const chapter = chapterOf(work);
  const title = shortWork(work);
  // QA 9:37 AM: a well-known work always gets its labeled general-knowledge summary
  // (deterministic, book level for a chapter); the web lookup only adds where to get it.
  const cat = wellKnownWork(work, ask ?? "");
  const catKnowledge: MaterialSummary | null = cat
    ? { kind: "knowledge", title: chapter && cat.bookLevel ? bookLevelTitle(title) : title, points: cat.points, sources: [], at: Date.now() }
    : null;
  const empty: WorkInvestigation = { work, title, known: Boolean(cat), knowledge: catKnowledge, found: null, offers: [] };
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return empty;
  const started = Date.now();
  const controller = new AbortController();
  // Known works don't wait on a slow web search (QA 9:37 AM: replies took 15-17 s).
  // Colton 1:54 R2: when we can't get it, say so and move forward; the lookup never holds the turn long.
  const timer = setTimeout(() => controller.abort(), cat ? 7_000 : 10_000);
  type Raw = { known?: boolean; author?: string; workTitle?: string; knowledge?: unknown; textPages?: { title: string; url: string }[]; offers?: { seller: string; url: string; price: string }[] };
  let o: Raw = {};
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        store: false,
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "system",
            content: `${RULES}
You investigate ONE assigned reading for a student who doesn't have it. Be smart and honest:
- "known": true only if you genuinely know this specific work well (a well-known book, chapter or article). If it's obscure, ambiguous or you're unsure which work it is, false.
- "knowledge": if known, 3-6 plain points on its main ideas from what you genuinely know (e.g. the named styles, models or components it's famous for, explained simply). When the work is known for a named list or model, one point names EVERY item of it (e.g. Goleman's "What Makes a Leader?": the five components of emotional intelligence: self-awareness, self-regulation, motivation, empathy, social skill). Never quotes, page numbers, or chapter details you aren't sure of; nothing invented. Empty if not known.
- Search the web for where it's LEGITIMATELY available: the publisher, Amazon or other real booksellers, rental services, or a legal open-access copy. Never pirate sites, shady PDF hosts or uploads of copyrighted books.
- "offers": up to 3 legit places to get it (seller name, the exact url from results, and the price exactly as shown in the search results, or "" if no price was shown). Never make up a price or url.
- "textPages": up to 2 legit pages with the actual text or an authoritative page about this exact work (publisher page, the author's page, open access). Empty if none.${chapter ? `
- This reading is ONE CHAPTER of a book. Chapter contents change between editions, so "knowledge" describes the BOOK overall (its main approaches and ideas) and never says what chapter ${chapter} or any numbered chapter contains. For "textPages", look for that edition's table of contents or an excerpt that shows chapter ${chapter}'s actual content.` : ""}
JSON only.`,
          },
          { role: "user", content: `${ask ? `What the assignment asks: ${ask}\n` : ""}The assigned reading, as the assignment names it: ${clip(work, 300)}` },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "investigate",
            strict: true,
            schema: {
              type: "object",
              properties: {
                known: { type: "boolean" },
                author: { type: "string" },
                workTitle: { type: "string" },
                knowledge: { type: "array", items: { type: "string" } },
                textPages: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"], additionalProperties: false } },
                offers: {
                  type: "array",
                  items: { type: "object", properties: { seller: { type: "string" }, url: { type: "string" }, price: { type: "string" } }, required: ["seller", "url", "price"], additionalProperties: false },
                },
              },
              required: ["known", "author", "workTitle", "knowledge", "textPages", "offers"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.warn("[brief] investigate failed", { status: res.status });
      return empty;
    }
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const text =
      body.output_text ??
      body.output?.flatMap((x) => (x.type === "message" ? (x.content ?? []) : [])).find((c) => c.type === "output_text")?.text ??
      "";
    o = JSON.parse(text) as Raw;
  } catch (e) {
    console.warn("[brief] investigate error", { message: String((e as Error).message ?? e).slice(0, 120) });
    return empty;
  } finally {
    clearTimeout(timer);
  }
  const known = Boolean(cat) || o.known === true;
  // A chapter reading: book-level knowledge only, never "Chapter 4 covers…" (unverified).
  const points = !cat && known ? cleanPoints(o.knowledge, 6).filter((p) => !(chapter && CHAPTER_CLAIM.test(p))) : [];
  const knowledge: MaterialSummary | null =
    catKnowledge ?? (points.length >= 2 ? { kind: "knowledge", title: chapter ? bookLevelTitle(title) : title, points, sources: [], at: Date.now() } : null);
  // Offers: legit hosts only, link-checked, price only in a real "$NN.NN" shape.
  const rawOffers = (o.offers ?? []).filter((x) => legitHost(String(x.url ?? ""))).slice(0, 3);
  const checked = await checkLinks(rawOffers.map((x) => ({ title: clip(x.seller, 60), url: String(x.url) })));
  const offers: Offer[] = checked
    .map((c) => {
      const src = rawOffers.find((x) => x.url === c.url || hostOf(x.url) === hostOf(c.url));
      const price = String(src?.price ?? "").trim();
      return { seller: c.title || hostOf(c.url), url: c.url, price: PRICE.test(price) ? price : null };
    })
    // One link per seller (QA 6:03 AM: duplicate Amazon links).
    .filter((o, i, all) => all.findIndex((x) => hostOf(x.url) === hostOf(o.url) || x.seller.toLowerCase() === o.seller.toLowerCase()) === i);
  // The actual text: fetched by us, checked to be this exact work, summarized from the page only.
  let found: MaterialSummary | null = null;
  for (const c of cat ? [] : (o.textPages ?? []).filter((x) => legitHost(String(x.url ?? ""), { textPage: true })).slice(0, 2)) {
    const page = await fetchPageText(c.url);
    if (!page.ok) continue;
    if (!pageIsAboutWork(`${page.text} ${page.title}`, { author: clip(o.author, 60) || authorOf(work), title: clip(o.workTitle, 160) || titleOf(work) || "" })) continue;
    // A chapter is verified only by a page that shows that chapter.
    if (chapter && !pageShowsChapter(`${page.title} ${page.text}`, chapter)) continue;
    found = await summarizeText({ kind: "found", title, text: page.text, ask, source: { title: page.title || c.title, url: page.url } });
    if (found) break;
  }
  console.info("[brief] investigate", { ms: Date.now() - started, known, knowledge: Boolean(knowledge), found: Boolean(found), offers: offers.length });
  return { work, title, known: known && Boolean(knowledge), knowledge, found, offers };
}

const NAMED_LIST = /\b(two|three|four|five|six|seven)\b[^.]{0,40}\b(components|elements|styles|traits|factors|stages|types|behaviors|skills|dimensions|principles)\b/i;
/** What to show for one work: the found text first; her labeled knowledge too when it names the work's list or model and the page didn't. */
export function workSummaries(i: Pick<WorkInvestigation, "found" | "knowledge">): MaterialSummary[] {
  if (!i.found) return i.knowledge ? [i.knowledge] : [];
  const fromPage = i.found.points.join(" ");
  const adds = i.knowledge && NAMED_LIST.test(i.knowledge.points.join(" ")) && !NAMED_LIST.test(fromPage);
  return adds ? [i.found, i.knowledge!] : [i.found];
}

const STOP = new Set(["the", "a", "an", "of", "and", "in", "on", "to", "for", "what", "is", "by", "with"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

export function authorOf(work: string): string {
  return work.match(/\bby\s+(?:[A-Z][\w.-]*\s+)*([A-Z][\w-]+)\b/)?.[1] ?? work.match(/\(([A-Z][\w-]+)[,)]/)?.[1] ?? "";
}
export function titleOf(work: string): string | null {
  return work.match(/[“"']([^”"']{4,120})[”"']/)?.[1] ?? null;
}

/** Author's name + at least 3/4 of the title's words appear in the page. */
export function pageIsAboutWork(page: string, w: { author: string; title: string; named?: string }): boolean {
  const p = ` ${page.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ")} `;
  if (!w.author || !p.includes(` ${w.author.toLowerCase()} `)) return false;
  const t = tokens(w.title);
  if (!t.length) return false;
  const hit = t.filter((x) => p.includes(` ${x} `)).length;
  return hit / t.length >= 0.75;
}

/** "the assigned HBR article 'What Makes a Leader?' by Daniel Goleman" → "Goleman's “What Makes a Leader?”". */
export function shortWork(w: string): string {
  const t = w.replace(/\s+/g, " ").trim();
  const title = t.match(/[“"']([^”"']{4,90})[”"']/)?.[1];
  const by = t.match(/\bby\s+(?:[A-Z][\w.-]*\s+)*([A-Z][\w-]+)\b/)?.[1] ?? t.match(/\(([A-Z][\w-]+)[,)]/)?.[1];
  const ch = t.match(/\b(?:chapter|ch\.?)\s*(\d+)/i)?.[1];
  if (by && title) return `${by}'s “${title}”`;
  // "Field Notes on Quiet Persistence by Marisol Tenhagen (course packet, 2019)" → "Tenhagen's “Field Notes on Quiet Persistence”"
  const bare = t.match(/^([A-Z][^()]{3,70}?)\s+by\s+[A-Z]/)?.[1];
  if (by && bare && !/\b(chapter|ch\.)/i.test(bare)) return `${by}'s “${bare.trim()}”`;
  // QA 3:06: "Chapter 6 (Memory) in Myers' Psychology, 13th edition" → "Myers' Psychology, Ch. 6" (never "Memory Ch. 6").
  const owned = t.match(/\b([A-Z][\w-]+(?:'s|’s|'|’)\s+[A-Z][^,;()]{2,50}?)(?=\s*[,;()]|\s+\d|$)/)?.[1];
  if (owned && ch) return `${owned.trim()}, Ch. ${ch}`;
  if (by && ch) return `${by} Ch. ${ch}`;
  // "Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice)" → "Northouse's Leadership: Theory and Practice, Ch. 4"
  const ab = t.match(/\b([A-Z][\w-]+),\s+([A-Z][^,;()]{3,50}?)(?=[,;()]|$)/);
  if (ab && ch) return `${ab[1]}'s ${ab[2]!.trim()}, Ch. ${ch}`;
  if (title) return `“${title}”`;
  return t.length <= 50 ? t : `${t.slice(0, 47).replace(/\s+\S*$/, "")}…`;
}

/** The assignment needs a real person, leader or organization as the example (QA 6:03 AM). */
export const NEEDS_REAL_PERSON = /\b(?:one|a|an|at least one) real(?:-world)? (?:leader|person|people|figure|ceo|manager|coach|example of a leader|individual|historical figure)\b|\breal leader\b|\ba (?:specific|well-known|real) (?:leader|person|figure)\b/i;

/** 2-3 real options the student must choose between (which leader, which style, which angle...), plus real people when the assignment needs one. */
export async function generateOptions(a: AssignmentBasics, ask: string | null, points: string[]): Promise<{ question: string; options: DecisionOption[]; people?: DecisionOption[]; basis?: "material" | "general" | "assignment"; concept?: string } | null> {
  const needsPerson = NEEDS_REAL_PERSON.test(`${a.topic ?? ""} ${a.prompt ?? ""} ${ask ?? ""} ${a.text.slice(0, 3000)}`);
  const sheet = `${a.prompt ?? ""} ${a.topic ?? ""} ${ask ?? ""} ${a.text}`;
  // QA 8:31 AM: a lost student always gets real options. Material first; when the chapter isn't
  // verified, general, well-established options (labeled as such); a yes/no prompt gets the sheet's own sides.
  const general = generalOptionsFor(sheet, needsPerson);
  const r = await grokChatJson({
    model: MODEL_FAST,
    system: `${RULES}\nYou help the student make a real first decision for this assignment.`,
    user: `${basicsText(a)}\n${ask ? `In plain words: ${ask}\n` : ""}${points.length ? `Key points from material we actually have (their copy, a page we fetched, or the sheet): ${points.join(" | ")}\n` : "No reading material is available yet: you know NOTHING about what the assigned readings say.\n"}\nReturn JSON: "question" = one short question naming the decision this assignment needs first (e.g. which style, which side, which angle), addressed to "you", no answer in it; "options" = 2-3 real, distinct options suited to THIS assignment, grounded in the key points (use the named ideas from the readings when there are some): "label" (under 8 words, a choice, not a sentence for their paper) and "why" (under 15 words: what THAT choice in particular would let them do; each why different and specific to its option, never the same line reworded); "general" = 3-4 general, well-established options from the field itself (standard textbook concepts anyone in the field would recognize, e.g. for leadership styles: transformational, situational, servant, task vs. relationship), same label/why shape, never presented as what any assigned reading says, or [] when the assignment is a yes/no or agree/disagree question.${needsPerson ? ` The assignment needs one real person as the example, so "people" = 2-3 real, well-known people who clearly fit these options (e.g. a leader famous for one of these styles), each "label" = the person's name and "why" = under 15 words on what they're known for that connects to the options (real, widely reported facts only).` : ' "people" = [].'} "concept" = 2 short plain sentences (under 45 words total) teaching the core idea a confused student needs before choosing, as general knowledge of the field (e.g. for a leadership paper: what leaders do, moving people or organizations toward a larger goal, using different styles), never what any assigned reading says, no names of readings or authors. Never a thesis. "options" may only use ideas that appear in those key points or in the assignment text itself. Never base an option on what an assigned reading, handout or chapter might say when it isn't in the key points (no guessing its content from its title).`,
    jsonSchema: {
      name: "options",
      schema: {
        type: "object",
        properties: {
          question: { type: "string" },
          concept: { type: "string" },
          options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, why: { type: "string" } }, required: ["label", "why"], additionalProperties: false } },
          general: { type: "array", items: { type: "object", properties: { label: { type: "string" }, why: { type: "string" } }, required: ["label", "why"], additionalProperties: false } },
          people: { type: "array", items: { type: "object", properties: { label: { type: "string" }, why: { type: "string" } }, required: ["label", "why"], additionalProperties: false } },
        },
        required: ["question", "concept", "options", "general", "people"],
        additionalProperties: false,
      },
    },
    timeoutMs: 9_000,
  });
  const yesNo = /\b(whether|should|to what extent|agree)\b/i.test(sheet) && !/\bwhich\b/i.test(`${a.prompt ?? ""} ${ask ?? ""}`);
  const sides = assignmentOnlyOptions(sheet);
  if (!r.ok) {
    if (yesNo && sides.length >= 2) return { question: "Where do you stand on the assignment's question so far?", options: sides, basis: "assignment" };
    return general;
  }
  try {
    const o0 = JSON.parse(r.text) as { question?: string; concept?: string; options?: unknown; general?: unknown; people?: unknown };
    const conceptRaw = clip(o0.concept, 320);
    const concept = conceptRaw && safe(conceptRaw) && !CHAPTER_CLAIM.test(conceptRaw) && !/\b(article|reading|chapter|textbook|author|HBR)\b/i.test(conceptRaw) ? conceptRaw : "";
    const withConcept = <T extends object | null>(x: T): T => (x && concept ? { ...x, concept } : x);
    const o = o0;
    // QA 7:02 AM: only options grounded in material we have or the sheet itself.
    const corpus = [a.topic, a.prompt, ask, a.text, ...points].filter(Boolean).join(" ");
    const grounded = cleanOptions(o.options).filter((x) => optionGrounded(x.label, corpus));
    const modelPeople = needsPerson ? cleanOptions(o.people).filter((p) => /^[A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){1,3}$/.test(p.label)) : [];
    const people = modelPeople.length >= 2 ? modelPeople : (general?.people ?? []);
    const question = clip(o.question, 200);
    // QA 8:31 AM live: "Which real leader…" answered with abstract descriptions ("Leader whose skills
    // failed…") is not a real choice. A person question needs real names; else the field's options.
    const asksPerson = /\b(?:which|what)\s+(?:real\s+|one\s+)?(?:leader|person|people|example|ceo|figure)\b|\bwho\b/i.test(question ?? "");
    const PERSON = /^[A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){1,3}$/;
    const realPick = !asksPerson || grounded.every((x) => PERSON.test(x.label));
    if (realPick && grounded.length >= 2 && question && safe(question)) return withConcept({ question, options: grounded, ...(people.length >= 2 ? { people } : {}), basis: "material" });
    if (yesNo && sides.length >= 2) return withConcept({ question: "Where do you stand on the assignment's question so far?", options: sides, basis: "assignment" });
    if (general) return withConcept({ ...general, ...(people.length >= 2 ? { people } : {}) });
    const fieldOptions = cleanOptions(o.general).filter((x) => !CHAPTER_CLAIM.test(`${x.label} ${x.why}`));
    if (fieldOptions.length >= 2 && question && safe(question)) return withConcept({ question, options: fieldOptions, ...(people.length >= 2 ? { people } : {}), basis: "general" });
    if (sides.length >= 2) return withConcept({ question: "Where do you stand on the assignment's question so far?", options: sides, basis: "assignment" });
    return null;
  } catch {
    return general;
  }
}

/** Step 2 extras (Colton 12:04 AM): more depth or a simpler rephrase of what she already taught. */
export async function materialMore(points: string[], mode: "depth" | "simpler", ask: string | null): Promise<string[] | null> {
  if (!points.length) return null;
  const r = await grokChatJson({
    model: MODEL_FAST,
    system: `${RULES}\nYou're re-teaching key points you already gave the student. Keep every claim you make inside what these points say or well-established general knowledge of the same ideas; never add quotes, page numbers or reading-specific details.`,
    user: `${ask ? `What the assignment asks: ${ask}\n` : ""}Your key points: ${points.map((p, i) => `${i + 1}. ${p}`).join(" ")}\n\n${mode === "depth" ? 'Return JSON "points": 3-5 points that go one level deeper (what each idea looks like in practice, one real-world example each), each under 40 words.' : 'Return JSON "points": the same ideas said much more simply, like to a 12-year-old, each under 25 words.'}`,
    jsonSchema: { name: "more", schema: { type: "object", properties: { points: { type: "array", items: { type: "string" } } }, required: ["points"], additionalProperties: false } },
    timeoutMs: 9_000,
  });
  if (!r.ok) return null;
  try {
    const out = cleanPoints((JSON.parse(r.text) as { points?: unknown }).points, 5);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

const VIDEO_HOST = /(^|\.)(youtube\.com|youtu\.be|khanacademy\.org|ted\.com|pbs\.org|pbslearningmedia\.org)$/i;

/** A real, link-checked explainer video on the concepts (never made up). */
export async function findVideo(topic: string, points: string[]): Promise<SourceRef[]> {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        store: false,
        tools: [{ type: "web_search" }],
        input: [
          { role: "system", content: "Find short, student-friendly explainer videos (YouTube, Khan Academy, TED, PBS) that teach the given ideas. Only real videos you found in search results, with their exact urls. JSON only." },
          { role: "user", content: `Ideas: ${clip(topic, 200)}. ${clip(points.join(" "), 600)}\nReturn JSON "videos": up to 2 (title + url).` },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "videos",
            strict: true,
            schema: {
              type: "object",
              properties: { videos: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"], additionalProperties: false } } },
              required: ["videos"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const text = body.output_text ?? body.output?.flatMap((x) => (x.type === "message" ? (x.content ?? []) : [])).find((c) => c.type === "output_text")?.text ?? "";
    const o = JSON.parse(text) as { videos?: SourceRef[] };
    const vids = (o.videos ?? []).filter((v) => {
      try {
        return VIDEO_HOST.test(new URL(v.url).hostname.replace(/^www\./, ""));
      } catch {
        return false;
      }
    });
    return (await checkLinks(vids.slice(0, 2).map((v) => ({ title: clip(v.title, 120), url: v.url })))).map((v) => ({ title: v.title, url: v.url }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
