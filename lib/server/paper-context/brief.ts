/**
 * The north-star Stage 1 brief (Colton t161u): the plain-words read-back, a
 * concise material summary, and 2-3 real options to decide between. All of it is
 * Pau Pau's teaching content: never paper text, never a thesis for the student.
 * // SOP: coaching only, never generate submission text
 */
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { checkLinks } from "@/lib/voice/realtime/links";
import { fetchPageText } from "@/lib/server/paper-context/fetch-page";
import {
  cleanOptions,
  cleanPoints,
  type DecisionOption,
  type MaterialKind,
  type MaterialSummary,
  type ReadbackPlain,
  type SourceRef,
} from "@/lib/stage1/paper-context";

const RULES = `You are Pau Pau, a writing coach for students (some are minors). You coach; you never write any part of their paper.
Hard rules: never suggest a thesis, a position, a topic sentence, or any sentence they could put in their paper. Never say what they "should argue". Plain words a 9th grader understands, no jargon (explain any term you must use). Be accurate: use only what the provided text says; if something isn't there, leave it out.`;

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
    user: `${input.ask ? `What the assignment asks: ${input.ask}\n` : ""}${input.kind === "reading" ? `Their course reading "${input.title}":` : input.kind === "found" ? `A page about their assigned reading "${input.title}" (${input.source?.url ?? ""}). Use ONLY what this page says; skip menus, ads and unrelated parts:` : "Their assignment sheet:"}\n"""${clip(input.text, 9000)}"""\n\nReturn JSON "points": 3-6 short, jargon-free key points from THIS text that matter for the assignment (facts, ideas, who/what/why). Each under 30 words. No opinions on what they should argue.`,
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
  if (by && ch) return `${by} Ch. ${ch}`;
  if (title) return `“${title}”`;
  return t.length <= 50 ? t : `${t.slice(0, 47).replace(/\s+\S*$/, "")}…`;
}

/** 2-3 real options the student must choose between (which leader, which style, which angle...). */
export async function generateOptions(a: AssignmentBasics, ask: string | null, points: string[]): Promise<{ question: string; options: DecisionOption[] } | null> {
  const r = await grokChatJson({
    model: MODEL_FAST,
    system: `${RULES}\nYou help the student make a real first decision for this assignment.`,
    user: `${basicsText(a)}\n${ask ? `In plain words: ${ask}\n` : ""}${points.length ? `Key points they now know: ${points.join(" | ")}\n` : ""}\nReturn JSON: "question" = one short question naming the decision this assignment needs first (e.g. which leader to focus on, which side, which style, which angle), addressed to "you", no answer in it; "options" = 2-3 real, distinct options suited to THIS assignment: "label" (under 8 words, a choice, not a sentence for their paper) and "why" (under 15 words: what that choice would let them do). Never a thesis. Use only the key points given and general concepts the assignment itself names; never claim what an assigned reading says unless it's in the key points.`,
    jsonSchema: {
      name: "options",
      schema: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, why: { type: "string" } }, required: ["label", "why"], additionalProperties: false } },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
    timeoutMs: 9_000,
  });
  if (!r.ok) return null;
  try {
    const o = JSON.parse(r.text) as { question?: string; options?: unknown };
    const options = cleanOptions(o.options);
    const question = clip(o.question, 200);
    return options.length >= 2 && question && safe(question) ? { question, options } : null;
  } catch {
    return null;
  }
}
