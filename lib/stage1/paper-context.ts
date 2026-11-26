import type { StartingPoint } from "@/lib/stage1/starting-point";
import { affirmsStyle, rejectsStyle } from "@/lib/stage1/style-negation";
import { singleNamedLeader } from "@/lib/stage1/single-name";
/**
 * Paper-level context (Colton t161u, the north star): what Pau knows about this
 * paper across Stages 1-3, so she meets the student where they are and never
 * re-asks what she already knows.
 *
 * Stored condensed in paper_autosaves under PAPER_CONTEXT_FIELD (JSON). Summaries
 * and the read-back are Pau's teaching content: never paper text, never put in
 * an answer box. The student's own words (decision, early take, angle) are kept
 * verbatim.
 * // SOP: coaching only, never generate submission text
 */
import { sameWork } from "@/lib/stage1/readings";

export const PAPER_CONTEXT_FIELD = "paper_context";

export type SourceRef = { title: string; url: string };

/** "reading": from a reading they gave us; "assignment": from the assignment sheet; "general": topic background, not their course reading. */
export type MaterialKind = "reading" | "found" | "knowledge" | "assignment" | "overview" | "general";
/** "knowledge": what she genuinely knows about a well-known named work (her knowledge, not the text). */
/** "found": from the actual named work, found online by her and fetched (source shown). */
/** "overview": general-knowledge overview of the named works (not their course copy). */

export type MaterialSummary = {
  kind: MaterialKind;
  title: string;
  points: string[];
  sources: SourceRef[];
  at: number;
};

export type ReadbackPlain = {
  /** What the assignment asks, in plain words (1-2 sentences). */
  ask: string;
  /** What a strong answer must include (short phrases). */
  mustInclude: string[];
  /** How it's graded (short phrases). */
  graded: string[];
};

export type DecisionOption = { label: string; why: string };

export type PaperContext = {
  v: 1;
  /** Set when the north-star Stage 1 steps apply to this paper (new papers only). */
  northstar?: boolean;
  /** When the material lookup was started (once per paper, at the read-back). */
  prefetchAt?: number;
  readback?: ReadbackPlain & { confirmed?: boolean };
  /** Readings the student pasted or uploaded (text clipped; summarized, never shown to the model whole). */
  readings?: { title: string; text: string; at: number; url?: string }[];
  /** Named readings she couldn't get (not uploaded, not found online): she asks for them, never guesses. */
  missing?: string[];
  /** Where each named reading is legitimately available (outbound links only; no in-app purchase). */
  whereToGet?: { title: string; known: boolean; offers: { seller: string; url: string; price?: string | null }[] }[];
  summaries?: MaterialSummary[];
  /** The decision question and its 2-3 options (Pau's), and the student's pick + reasoning (verbatim). */
  options?: {
    question: string;
    options: DecisionOption[];
    /** Colton 12:08: the core idea in plain words (general knowledge), taught to a lost student first. */
    concept?: string;
    /** When the assignment needs a real person or leader: 2-3 real, named people that fit (QA 6:03 AM). */
    people?: DecisionOption[];
    /** Where the options come from (QA 8:31 AM): material we have, general field knowledge (labeled), or the sheet's own question. */
    basis?: "material" | "general" | "assignment";
  };
  decision?: { question: string; pick: string; answer: string; at: number; source?: "asked" | "stated" };
  /** Their real person or leader, picked with a reason (verbatim). */
  leader?: { question: string; pick: string; answer: string; at: number };
  /** The student said they hadn't read / were lost (so later stages can re-offer the summary). */
  lostAtStart?: boolean;
  /** When Pau showed the material summary before the confirm (QA 7:02 AM: never re-ask "have you read it?"). */
  materialShownAt?: number;
  /**
   * PC-32 (Colton t221u): where the student is after Stage 1 (has ideas / has read the material /
   * no clue), with their idea in their own words. Stage 2 meets them there. (The ghost script is
   * never stored here: it lives encrypted in its own server-only row.)
   */
  startingPoint?: StartingPoint;
};

export const READING_MAX_CHARS = 12_000;
const POINT_MAX = 220;

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t;
};

export function emptyContext(): PaperContext {
  return { v: 1 };
}

export function parseContext(raw: string | null | undefined): PaperContext {
  if (!raw) return emptyContext();
  try {
    const o = JSON.parse(raw) as PaperContext;
    return o && typeof o === "object" && o.v === 1 ? o : emptyContext();
  } catch {
    return emptyContext();
  }
}

/** The latest summary of the best kind available: reading > assignment > general. */
export function bestSummary(ctx: PaperContext): MaterialSummary | null {
  const list = ctx.summaries ?? [];
  for (const kind of ["reading", "found", "knowledge", "assignment", "overview", "general"] as const) {
    const hit = [...list].reverse().find((s) => s.kind === kind && s.points.length);
    if (hit) return hit;
  }
  return null;
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
const NAMED_LIST_RE = /\b(two|three|four|five|six|seven)\b[^.]{0,40}\b(components|elements|styles|traits|factors|stages|types|behaviors|skills|dimensions|principles)\b/i;

/** Every summary from the latest material run (her knowledge and found text labeled apart). */
export function currentSummaries(ctx: PaperContext): MaterialSummary[] {
  const list = ctx.summaries ?? [];
  // QA 6:03 AM: every reading keeps its summary (their uploads and pastes, her knowledge, found pages).
  const smart = list.filter((s) => s.kind === "reading" || s.kind === "found" || s.kind === "knowledge");
  if (smart.length) {
    // One per work with ONE label (QA 7:02 AM): their own copy, else the found page,
    // else her knowledge (her knowledge wins only when it names the work's list and the page didn't).
    const rank = (x: MaterialSummary) => (x.kind === "reading" ? 3 : x.kind === "found" ? 2 : 1);
    const groups: MaterialSummary[][] = [];
    for (const s0 of [...smart].reverse()) {
      const g = groups.find((xs) => sameWork(xs[0]!.title, s0.title) || norm(xs[0]!.title) === norm(s0.title));
      if (g) g.push(s0);
      else groups.push([s0]);
    }
    const pick = groups.map((g) => {
      const best = [...g].sort((a, b) => rank(b) - rank(a) || b.at - a.at)[0]!;
      const know = g.find((x) => x.kind === "knowledge");
      if (best.kind === "found" && know && NAMED_LIST_RE.test(know.points.join(" ")) && !NAMED_LIST_RE.test(best.points.join(" "))) return know;
      return best;
    });
    return pick.slice(0, 6).reverse();
  }
  const best = bestSummary(ctx);
  return best ? [best] : [];
}

export function summaryLabel(s: MaterialSummary): string {
  if (s.kind === "reading") return `Key points from ${s.title || "your reading"}`;
  if (s.kind === "assignment") return "Key points from your assignment sheet";
  if (s.kind === "knowledge") return `What I know about ${s.title || "the reading"} (from my own knowledge, not your copy)`;
  if (s.kind === "found") return `Key points from ${s.title || "your reading"} (from the source I found online)`;
  if (s.kind === "overview") return `General overview of ${s.title || "the assigned works"} (not your course copy)`;
  return "General background (not from your readings)";
}

/** The summary as Pau's chat bubbles: a labeled lead-in, then the points. Teaching content only. */
export function summaryParas(s: MaterialSummary): string[] {
  const lead =
    s.kind === "reading"
      ? `Here are the key points from ${s.title || "your reading"}, in plain words:`
      : s.kind === "knowledge"
        ? `I don't have your copy of ${s.title || "the reading"}, so this is general background, not from your copy. Editions can differ, so if you upload the pages (photos or a PDF) I'll match your exact text. For now, the key ideas:`
        : s.kind === "found"
        ? `I found ${s.title || "your reading"} online, so here are its key points in plain words (from the page linked below):`
        : s.kind === "assignment"
        ? "Here's what the assignment sheet itself gives you to work with, in plain words:"
        : s.kind === "overview"
          ? `I don't have your copies, so here's general background on ${s.title || "the assigned works"}, from what's widely known about them. It's not your course copy, so check it against your book and notes:`
          : "This isn't from your readings. It's general background on the ideas the assignment names, so check it against what your class covered:";
  return [lead, ...s.points.map((p) => `• ${p}`)];
}

/** One line to say the summary out loud (voice: she says it in her own words). */
export function summarySpoken(s: MaterialSummary): string {
  const label =
    s.kind === "general"
      ? "General background, not their course reading"
      : s.kind === "overview"
        ? `General overview of ${s.title || "the assigned works"}, not their course copy`
        : s.kind === "knowledge"
          ? `What you know about ${s.title || "the reading"} from your own knowledge, not their copy (say so)`
        : summaryLabel(s);
  return `${label}: ${s.points.join(" ")}`;
}

/* ----------------------------- student signals ----------------------------- */

/** "I haven't read it", "no idea where to start", "what is this even about": offer the summary. */
const LOST =
  /\b(haven'?t|have not|didn'?t|did not|never) (read|done the reading|looked at|opened)|\bno (idea|clue)\b|\b(don'?t|do not) know (where|how) to (start|begin)|\b(don'?t|do not) (get|understand) (it|this|the (reading|assignment|material|book|article))|\bi'?m (lost|confused|stuck)\b|\bwhat (is|was) (this|it|the reading|the book|the article) (even )?about\b|\b(summar(y|ize)|sum (it|this) up|key points|catch me up|give me the gist|explain the (reading|material|book|article))\b|\bnot read (it|anything|the)/i;

export function isLostSaying(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= 400 && LOST.test(t);
}

/** "Yes, I read it" / "I've done the reading": a prepared student. */
const READY = /\b(yes|yeah|yep|i (have|did|read)|i'?ve (read|done))\b.*\b(read|reading|done|finished|it)\b|^(yes|yeah|yep)[.!]?$/i;
export function isPreparedSaying(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return !isLostSaying(t) && READY.test(t);
}

/* ------------------------- summary stays out of boxes ------------------------- */

const tok = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** Their answer is mostly Pau's summary or read-back (pasted or echoed back): not their words. */
export function overlapsTeaching(answer: string, ctx: PaperContext): boolean {
  const w = tok(answer);
  if (w.length < 8) return false;
  const teach = [
    ...(ctx.summaries ?? []).flatMap((s) => s.points),
    ctx.readback?.ask ?? "",
    ...(ctx.readback?.mustInclude ?? []),
  ].join(" ");
  const t = tok(teach);
  if (t.length < 8) return false;
  const grams = new Set(t.slice(2).map((x, i) => `${t[i]} ${t[i + 1]} ${x}`));
  let hit = 0;
  for (let i = 2; i < w.length; i++) if (grams.has(`${w[i - 2]} ${w[i - 1]} ${w[i]}`)) hit++;
  return hit / (w.length - 2) >= 0.5;
}

/* ----------------------- model output: teaching only ----------------------- */

/** A summary point or read-back line that reads like paper text (a thesis or sentence for them) is dropped. */
const PAPER_TEXT =
  /\b(your thesis (could|should|might) be|you could (write|say|argue)|in (this|my) (essay|paper),? i\b|\bi (believe|argue|will argue)|a (good|strong) thesis (would be|is)|thesis:|topic sentence:|here'?s (a|your) (thesis|sentence|paragraph|intro))\b/i;

export function cleanPoints(points: unknown, max = 6): string[] {
  if (!Array.isArray(points)) return [];
  return points
    .filter((p): p is string => typeof p === "string")
    // Bullets and "1." / "2)" markers only: "1,200-1,500 words" keeps its number (QA 6:03 AM).
    .map((p) => clip(p.replace(/^\s*(?:[•\-*]+|\d{1,2}[.)](?=\s))\s*/, ""), POINT_MAX))
    .filter((p) => p.length >= 8 && !PAPER_TEXT.test(p))
    .slice(0, max);
}

const capFirst = (s: string) => (s && /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export function cleanOptions(raw: unknown): DecisionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => (o && typeof o === "object" ? (o as { label?: unknown; why?: unknown }) : {}))
    // QA 3:51: labels start with a capital ("Spacing effect", never "spacing effect").
    .map((o) => ({ label: capFirst(clip(String(o.label ?? ""), 80)), why: clip(String(o.why ?? ""), 160) }))
    .filter((o) => o.label.length >= 2 && !PAPER_TEXT.test(`${o.label} ${o.why}`))
    .slice(0, 3)
    // A "why" repeated across options says nothing (QA run 12:21 AM): drop the copies.
    .map((o, _i, all) => (all.filter((x) => x.why.toLowerCase() === o.why.toLowerCase()).length > 1 ? { ...o, why: "" } : o));
}

/** The student's pick: which option their answer names (or "their own"). */
const GENERIC_PICK_WORD = /^(team|teams|leadership|leader|leaders|style|styles|management|approach|focus|angle|option|people|group|work|change|side|idea|ideas|time|together)$/;
/** The word right after "I'd pick / going with / choose" ("transformational"), if any. */
export function namedPickWord(answer: string): string | null {
  return answer.toLowerCase().match(/\b(?:pick|picking|go with|going with|choose|chose|choosing|argue for|arguing for)\s+(?:the\s+)?([a-z][a-z-]{3,})/)?.[1] ?? null;
}
/** Does their answer really name this option (not just share a word like "team")? */
export function answerNamesOption(answer: string, label: string): boolean {
  const a = answer.toLowerCase();
  const words = tok(label).filter((x) => x.length > 3);
  const distinct = words.filter((x) => !GENERIC_PICK_WORD.test(x));
  const use = distinct.length ? distinct : words;
  if (!use.length) return false;
  // QA prod smoke (64a5b2bd): an option named only to set it aside ("not transformational") isn't named as their pick.
  if (use.every((x) => !a.includes(x) || rejectsStyle(a, x))) return false;
  const named = namedPickWord(answer);
  if (named && !GENERIC_PICK_WORD.test(named) && !words.some((w) => w.startsWith(named.slice(0, 5)) || named.startsWith(w.slice(0, 5)))) return false;
  return use.filter((x) => a.includes(x)).length / use.length >= 0.5;
}

export function pickFrom(answer: string, options: DecisionOption[]): string {
  const a = answer.toLowerCase();
  let best: { label: string; score: number } | null = null;
  for (const o of options) {
    if (!answerNamesOption(answer, o.label)) continue;
    const words = tok(o.label).filter((x) => x.length > 3 && !GENERIC_PICK_WORD.test(x));
    const score = words.length ? words.filter((x) => a.includes(x)).length / words.length : 0.5;
    if (!best || score > best.score) best = { label: o.label, score };
  }
  const m = a.match(/\b(?:option|number|choice)\s*(one|two|three|1|2|3)\b|\bthe (first|second|third) one\b/);
  if (!best && m) {
    const n = { one: 0, "1": 0, first: 0, two: 1, "2": 1, second: 1, three: 2, "3": 2, third: 2 }[(m[1] ?? m[2]) as string];
    if (n !== undefined && options[n]) return options[n].label;
  }
  return best?.label ?? "their own";
}

/** The decision question with its options, as the app's question text. */
export function decisionQuestion(opts: NonNullable<PaperContext["options"]>, ctx?: { prepared?: boolean; ask?: string | null }): string {
  // Colton 11:41: 2-3 real options, never a long menu.
  let few = opts.options.slice(0, 3);
  let q = opts.question.trim().replace(/[?.!\s]+$/, "") + "?";
  // QA 1:16 (PSY): bare "Yes" / "No" options to a "whether X or Y" ask become the two real sides.
  const w = (ctx?.ask ?? "").replace(/\s+/g, " ").match(/\bwhether ([a-z][^.?;,]{2,60}?) or ((?:not|[a-z])[^.?;,]{1,60})/i);
  if (w && few.length && few.every((o) => /^(yes|no|both|neither|it depends|maybe)\b/i.test(o.label.trim()))) {
    const a = w[1]!.trim();
    const b = w[2]!.trim().replace(/\s+(with|using|and use|in|for|plus)\b.*$/i, "");
    // "stress helps" or "hurts memory": give the second side the first one's subject.
    const subj = a.split(" ")[0]!;
    const bFull = b.split(" ").length >= 2 && !b.toLowerCase().startsWith(subj.toLowerCase()) ? `${subj} ${b}` : b;
    const aFull = a.split(" ").length < 3 && b.split(" ").length >= 2 ? `${a} ${b.split(" ").slice(1).join(" ")}` : a;
    few = [
      { label: aFull.replace(/^./, (c) => c.toUpperCase()), why: few[0]?.why },
      { label: bFull.replace(/^./, (c) => c.toUpperCase()), why: few[1]?.why },
      { label: "Both, depending on the situation", why: few[2]?.why ?? "Lets you show when each side holds." },
    ];
    q = `Gut answer first, even a guess: ${aFull} or ${bFull}?`;
  }
  const list = few.map((o, i) => `${i + 1}) ${o.label}${o.why ? ` (${o.why})` : ""}`).join("; ");
  // QA 10:21: a student who has read it gets an open ask; the list is only a nudge.
  if (ctx?.prepared)
    return `${q} You've done the reading, so tell me your pick and your reason. If it helps, the usual contenders are ${few.map((o) => o.label).join(", ")}.`;
  // QA 12:48 #3: one ask per turn. The opener is already the question, so the close after the list is a statement.
  const opener = q;
  const close = /\?\s*$/.test(q.trim()) ? "Pick one, or name something else, and say why." : "Which one would you pick, or something else, and why?";
  if (opts.basis === "general")
    return `${opener} I haven't seen your edition yet, so these are general, well-established options from the field, not your chapter's own list: ${list}. ${close}`;
  return `${opener} Here are a few real options: ${list}. ${close}`;
}

/**
 * General, well-established options (QA 8:31 AM): a lost student always gets real options.
 * Labeled as general knowledge, never as what a chapter or handout says.
 */
const GENERAL_CATALOG: { when: RegExp; question: string; options: DecisionOption[]; people: DecisionOption[] }[] = [
  {
    // QA 3:51: the options are parts of the serial position effect itself, never neighboring study tips.
    when: /\bserial[- ]position\b/i,
    question: "Which part of the serial position effect do you want to build your study advice around",
    options: [
      { label: "Primacy effect", why: "Lets you argue for putting the hardest material first in each study session." },
      { label: "Recency effect", why: "Lets you argue for reviewing the key material last, right before the exam." },
      { label: "Both: many short sessions", why: "Lets you argue that short blocks create more first and last moments to remember." },
    ],
    people: [],
  },
  {
    when: /\bleadership (?:styles?|approach(?:es)?|theor(?:y|ies)|models?)\b|\bwhich (?:style of )?leadership\b|\bleadership style\b/i,
    question: "Which leadership style do you want to argue works best here",
    options: [
      { label: "Transformational", why: "Lets you show a leader selling a shared vision so people want the change." },
      { label: "Situational", why: "Lets you show a leader shifting style to fit how ready the team is." },
      { label: "Servant", why: "Lets you show a leader who puts the team's needs first so people come through the change together." },
      { label: "Behavioral: task vs. relationship (team management)", why: "Lets you show a leader balancing getting the work done with caring for the people." },
    ],
    people: [
      { label: "Satya Nadella", why: "Reshaped Microsoft's culture toward learning after taking over in 2014." },
      { label: "Alan Mulally", why: "Led Ford's turnaround with his \"One Ford\" plan and weekly reviews." },
      { label: "Indra Nooyi", why: "Steered PepsiCo toward healthier products under \"Performance with Purpose.\"" },
    ],
  },
];
export function generalOptionsFor(text: string, needsPerson = false): NonNullable<PaperContext["options"]> | null {
  const t = (text ?? "").replace(/\s+/g, " ");
  const hit = GENERAL_CATALOG.find((c) => c.when.test(t));
  if (!hit) return null;
  return { question: hit.question, options: hit.options, ...(needsPerson ? { people: hit.people } : {}), basis: "general" };
}

/* --------------------------- the condensed block --------------------------- */

export type ContextExtras = {
  earlyTake?: string | null;
  ownAngle?: string | null;
  voiceSample?: string | null;
  lockedPoints?: { section: string; points: string[] }[];
};

/** What she knows about this paper, condensed for prompts and the relay (data only). ~1600 chars max. */
export function paperContextBlock(ctx: PaperContext, extra: ContextExtras = {}): string {
  const lines: string[] = [];
  if (ctx.readback?.ask) {
    lines.push(`Assignment, in plain words${ctx.readback.confirmed ? " (the student confirmed this)" : ""}: ${clip(ctx.readback.ask, 300)}`);
    if (ctx.readback.mustInclude.length) lines.push(`A strong answer must include: ${clip(ctx.readback.mustInclude.join("; "), 240)}`);
    if (ctx.readback.graded.length) lines.push(`Graded on: ${clip(ctx.readback.graded.join("; "), 160)}`);
  }
  for (const s of currentSummaries(ctx).slice(0, 3)) {
    lines.push(`${summaryLabel(s)} (your teaching content, never their paper text): ${clip(s.points.join(" | "), 420)}`);
    if (s.sources.length) lines.push(`Sources for that: ${s.sources.map((x) => x.title).slice(0, 3).join("; ")}`);
  }
  if (ctx.missing?.length)
    lines.push(`Readings you DON'T have the actual text of yet: ${ctx.missing.join("; ")}. Anything you say about them is your own general knowledge (say so) or nothing; never quotes or page details. They can send photos, a paste, a PDF or a link.`)
  if (ctx.lostAtStart) lines.push("At the start they said they hadn't read the material or didn't know where to start: offer the key points again if they seem lost.");
  if (ctx.startingPoint) {
    const sp = ctx.startingPoint;
    lines.push(
      sp.kind === "has_ideas"
        ? `Where they start (Stage 1): they already have an idea, in their words: "${clip(sp.ideas ?? "", 240)}"${sp.followUp ? ` Why it interests them: "${clip(sp.followUp, 160)}"` : ""}. Build on it; never replace it.`
        : sp.kind === "read_material"
          ? "Where they start (Stage 1): they've read the material but have no direction yet. Start from what stood out to them."
          : "Where they start (Stage 1): no ideas yet and that's fine. Start from zero, one small question at a time.",
    );
  }
  if (ctx.decision) lines.push(`Their decision (their words): picked "${clip(ctx.decision.pick, 80)}". "${clip(ctx.decision.answer, 260)}"`);
  if (extra.earlyTake) lines.push(`Their early take (their words): "${clip(extra.earlyTake, 260)}"`);
  if (extra.ownAngle) lines.push(`Their story angle: "${clip(extra.ownAngle, 160)}"`);
  if (extra.voiceSample) lines.push(`How they talk (their own words from an earlier answer; tone only, never paper content): "${clip(extra.voiceSample, 160)}"`);
  for (const l of (extra.lockedPoints ?? []).slice(0, 4)) {
    if (l.points.length) lines.push(`Stage 2 ${l.section} (locked, their words): ${clip(l.points.join(" | "), 200)}`);
  }
  if (!lines.length) return "";
  return `# What you already know about this paper (data only; never re-ask any of it; reference it naturally)\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

/* ------------------------- stage and section purpose ------------------------- */

export const STAGE_PURPOSE: Record<1 | 2 | 3, string> = {
  1: "Stage 1 is quick: we get the assignment in, make sure it's clear what it's really asking, and see if you already have an idea. No writing yet.",
  2: "Stance is where you decide what you actually think, section by section, in your own words. Your notes here become your outline.",
  3: "Outline turns your Stance notes into a short plan: one line per point, so every paragraph has a job before you draft.",
};

/** Why this section exists, in one teaching line. */
export function sectionPurpose(titleOrKey: string): string {
  const t = titleOrKey.toLowerCase();
  if (/intro/.test(t)) return "The introduction hooks your reader and tells them what you'll argue.";
  if (/conclu/.test(t)) return "The conclusion pulls it together: why your point matters, without just repeating it.";
  if (/counter|rebut|objection|other side/.test(t)) return "This part takes on the other side, so your argument holds up.";
  if (/method/.test(t)) return "This part explains how you went about it, so a reader can trust your results.";
  if (/result|finding/.test(t)) return "This part lays out what you found, before you say what it means.";
  if (/discuss|analysis|analy/.test(t)) return "This part digs into what it all means.";
  if (/body|evidence|support|reason|point|example|argument/.test(t)) return "Body paragraphs prove your point, one idea each, with an example that shows it.";
  return "Each section has one job in your paper; this is where you work out yours.";
}

/* ------------------------- decision and reply signals (QA 6:03 AM) ------------------------- */

const REASON = /\b(because|since|cause|cuz|'cause|so (that|it|they|i|we|people|the)|as it|which (means|lets|helps|shows)|that way|it (helps|lets|shows|works|makes|gives|fits|keeps|gets)|they (help|let|show|keep|get)|to (show|prove|explain|keep|help)|for (example|instance)|like when)\b/i;
/** Their pick comes with a why (the Stage 1 advance check needs one). */
export function decisionHasReason(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return t.split(" ").length >= 5 && REASON.test(t) && !isVaguePick(t);
}

const HEDGE = /\b(idk|i don'?t know|dunno|i guess|maybe|whatever|not sure|probably|any of them|either one|i suppose|kinda|sort of)\b/i;
/** "idk, the team one I guess": a lean, no real reason. */
export function isVaguePick(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  // A long paste is material, never a pick (QA 8:31 AM walk B).
  if (t.split(" ").length >= 35 && !STANCE_CUE.test(t)) return false;
  // A clear stance ("I want to argue transformational leadership, using Satya Nadella") is a pick; its reason is asked next.
  if (!HEDGE.test(t) && STANCE_CUE.test(t) && t.split(" ").length >= 4) return false;
  if (REASON.test(t) && t.split(" ").length >= 8 && !/^(idk|dunno|i don'?t know)\b/i.test(t)) return false;
  return HEDGE.test(t) || t.split(" ").length < 4 || !REASON.test(t);
}

/** The option their words lean toward ("the team one" → the option with "team" in it), or null. */
export function guessPick(text: string, options: DecisionOption[]): DecisionOption | null {
  const a = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ")} `;
  let best: { o: DecisionOption; n: number } | null = null;
  for (const o of options) {
    const words = tok(o.label).filter((x) => x.length > 3 && !/^(leadership|style|option|approach|focus|angle)$/.test(x));
    const n = words.filter((w) => a.includes(` ${w} `) || a.includes(` ${w.slice(0, 5)}`)).length;
    if (n > 0 && (!best || n > best.n)) best = { o, n };
  }
  const m = a.match(/\b(first|second|third|1st|2nd|3rd|one|two|three)\b (one|option)/);
  if (!best && m) {
    const i = { first: 0, "1st": 0, one: 0, second: 1, "2nd": 1, two: 1, third: 2, "3rd": 2, three: 2 }[m[1] as "first"];
    if (options[i]) return options[i]!;
  }
  return best?.o ?? null;
}

/** The probe for a vague pick: name the option and ask why. */
export function vaguePickProbe(text: string, options: DecisionOption[]): string {
  const g = guessPick(text, options);
  return g
    ? `Sounds like you're leaning toward ${g.label}. Why that one? What about it fits this assignment for you? One sentence is plenty.`
    : options.length
      ? `Which one are you leaning toward (${options.map((o) => o.label).join(", ")}), and why? One sentence is plenty.`
      : "Which one do you mean? Name it in your own words and say why. One sentence is plenty.";
}

const STANCE_CUE = /\b(i (want|plan|intend|'?m planning|am planning) to (argue|write about|focus on|use|go with|pick)|i'?m going to (argue|use|write about|focus on|go with)|i'?d (argue|go with|pick|choose|use|focus on)|arguing (that|for)|my thesis|going with|go with|i'?ll (go with|argue|pick|use|focus on|write about)|i'?m (going with|arguing|picking|focusing on|writing about|leaning)|my (pick|stance|argument|choice|angle) is|i (pick|chose|choose|picked)|i think .{3,60} (is|works|was) (the )?(best|most))\b/i;
/** A prepared student's stated stance ("transformational, Satya Nadella"): captured as the decision, not re-asked. */
export function statedStance(text: string, options: DecisionOption[] = [], people: DecisionOption[] = []): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || isLostSaying(t)) return null;
  const sentences = t.split(/(?<=[.!?])\s+/);
  const hit = sentences.filter((x) => STANCE_CUE.test(x) || options.some((o) => guessPick(x, [o])) || people.some((o) => guessPick(x, [o])));
  // Never "I read both" or "yes": only the stance itself.
  const stance = hit.filter((x) => !/^(yes|yeah|yep|i (read|did|have)|i'?ve read)\b[^,]*[.!]?$/i.test(x)).join(" ").trim();
  if (!stance) return null;
  return STANCE_CUE.test(stance) || options.some((o) => guessPick(stance, [o])) ? stance : null;
}

/** Before the read-back is confirmed: what kind of question it is (answered in place, never deflected). */
export type PreConfirmRoute = "material" | "options" | "explain" | null;
const MATERIAL_Q = /\b(what (is|does|did|are) .{2,70}? (say|saying|said|about|argue|arguing|mean)|what'?s .{2,60}? (saying|about)|summar(y|ize|ise)|key points|the gist|catch me up|tell me about (the|this) (reading|article|chapter|handout|book)|what (do|did) (the|these) (readings?|articles?|chapters?|handouts?) say)\b/i;
const OPTIONS_Q = /\b(what (are|r) (the|my|some) (options|choices|directions)|(tell|give|show) me (the |some |my )?(options|choices|directions)|what (can|could|should) i (write|pick|choose|argue|go with)|just tell me (the |some )?options|what (the|my|some) (options|choices|directions) (are|would be)|which (options|choices) (do|can) i (have|pick))\b/i;
const EXPLAIN_Q = /\b((idk|i don'?t know|no idea|not sure) what (this|it|that|the assignment) (even )?means|what does (this|that|it|the assignment) (even )?mean|i don'?t (get|understand) (it|this|the assignment|what (it|this) (means|wants))|explain (it|this|the assignment)|what am i (supposed|meant) to (do|write)|what (is|does) (this|it) (even )?(asking|want))\b/i;
export function preConfirmRoute(text: string): PreConfirmRoute {
  const t = text.replace(/\s+/g, " ").trim();
  if (OPTIONS_Q.test(t)) return "options";
  if (EXPLAIN_Q.test(t)) return "explain";
  if (MATERIAL_Q.test(t)) return "material";
  return null;
}
export function isOptionsRequest(text: string): boolean {
  return OPTIONS_Q.test(text) || /^(just )?(give me|tell me|show me) (some )?(options|ideas|choices)\b/i.test(text.trim());
}
export function isReadingQuestion(text: string): boolean {
  return MATERIAL_Q.test(text.replace(/\s+/g, " ").trim());
}

/**
 * t222u light engagement: a comment about a reading (not a question, not their pick
 * or example) should be acknowledged and noted, never treated as a short example-moment answer.
 * "Northouse ch 4 covers the behavioral approach, which I found interesting."
 */
const READING_SOURCE =
  /\b(?:northouse|goleman|textbook|handout|article|hbr|(?:the|this|our|my|assigned)\s+(?:reading|article|chapter|textbook|handout|book)|(?:chapter|ch\.?)\s*\d{1,2})\b/i;
const READING_COMMENTARY =
  /\b(?:covers?|discusses?|talks? about|explains?|describes?|goes over|focuses on|outlines?|presents?|I (?:found|thought|liked|loved|noticed)|interesting|stood out|useful|helpful|surprised me)\b/i;
const READING_AS_ANSWER =
  /\b(?:I (?:want to|would|'d) (?:argue|pick|use|write)|works? best|my (?:leader|example|pick|angle) is|when (?:he|she|they)\b|(?:visited|walked) (?:the )?stores?|profit sharing)\b/i;

export function isReadingComment(text: string): boolean {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t || /\?\s*$/.test(t) || isReadingQuestion(t)) return false;
  if (!READING_SOURCE.test(t) || !READING_COMMENTARY.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  // A real pick or example that happens to mention a reading stays their answer.
  if (READING_AS_ANSWER.test(t) && words >= 18) return false;
  return true;
}

/** Acknowledge the comment in their terms. Never claim what a chapter contains, and never ask for a leader-moment. */
export function readingCommentAck(text: string): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const ch = t.match(/\b(?:chapter|ch\.?)\s*(\d{1,2})\b/i)?.[1];
  const work = /\bnorthouse\b/i.test(t)
    ? "Northouse"
    : /\bgoleman\b/i.test(t)
      ? "Goleman"
      : /\bhbr\b/i.test(t)
        ? "the HBR article"
        : /\btextbook\b/i.test(t)
          ? "the textbook"
          : /\bhandout\b/i.test(t)
            ? "the handout"
            : /\barticle\b/i.test(t)
              ? "the article"
              : ch
                ? `ch ${ch}`
                : "the reading";
  const source = /\bnorthouse\b/i.test(t) && ch ? `Northouse ch ${ch}` : /\bgoleman\b/i.test(t) && ch ? `Goleman ch ${ch}` : work === `ch ${ch}` ? work : ch && work !== `ch ${ch}` ? `${work} ch ${ch}` : work;
  const topic = t.match(/\bthe\s+([a-z]+(?:\s+[a-z]+){0,4}\s+approach)\b/i)?.[0]
    ?? t.match(/\b((?:task|relationship|skills?|behavioral|trait|situational|transformational|servant|emotional intelligence|empathy)(?:\s+(?:vs\.?|versus|and|approach|style|leadership|intelligence)){0,4})\b/i)?.[0]
    ?? null;
  const what = topic ? `${topic} in ${source}` : source;
  return `Got it — you found ${what} interesting. I've noted that.`;
}

/**
 * A pasted reading paragraph, not their own words (QA 6:03 AM): long, mostly
 * pasted, and barely any first person. It goes in as material, never as an answer or angle.
 */
export function looksLikePastedReading(text: string, pasteRatio = 0): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean);
  if (words.length < 40) return false;
  const firstPerson = words.filter((w) => /^(i|i'm|i've|i'd|i'll|my|me|mine|im|ive)$/i.test(w.replace(/[^a-z']/gi, ""))).length;
  const ratio = firstPerson / words.length;
  if (pasteRatio >= 0.6 && ratio < 0.02) return true;
  // Typed or pasted (QA 7:02 AM: typed into chat, no paste event): long, several
  // full sentences, almost no first person, and not opening like a student talking.
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z“"])/).filter((x) => x.split(" ").length >= 5).length;
  const chatty = /^(i|i'm|im|i've|my|yeah|yes|no|ok|okay|so|um|idk|honestly|well)\b/i.test(t);
  if (chatty) return false;
  if (words.length >= 40 && sentences >= 3 && ratio < 0.02) return true;
  return words.length >= 120 && sentences >= 4 && ratio < 0.03;
}

/** Colton: "if we know something, share it". Never a "that'd be doing the reading for you" refusal. */
const REFUSAL =
  /[^.!?]*\b(can'?t|cannot|won'?t|shouldn'?t|not going to|not able to|unable to)\b[^.!?]{0,40}\b(summari[sz]e|explain|tell you what|go over|break down)\b[^.!?]*[.!?]?|[^.!?]*\b(that'?d|that would|it would) be doing (the|your) (reading|work|homework)\b[^.!?]*[.!?]?/gi;
export function stripReadingRefusal(text: string): string {
  return text.replace(REFUSAL, " ").replace(/\s+/g, " ").trim();
}

/** No hollow praise for a student who said "idk" (QA 6:03 AM): a leading "Great question!" / "Nice!" / "Love that." goes. */
const HOLLOW_PRAISE = /^\s*(?:(?:great|good|nice|awesome|perfect|excellent|love (?:that|it|this)|i love (?:that|this)|solid|amazing|wonderful|fantastic|that tracks|makes sense|cool|ooh|oh nice|okay nice|this one'?s got legs)(?:\s+(?:question|thinking|start|point|thought|one|call|answer|job|work))?|that'?s (?:a )?(?:great|good|really good|awesome|perfect|solid)(?:\s+(?:question|start|point|thought|one|answer))?)\s*[!.,]+\s*/i;
export function stripHollowPraise(text: string): string {
  const out = text.replace(HOLLOW_PRAISE, "");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : text;
}

/**
 * R0 (QA 8:31 AM): never claim what a chapter, textbook or handout contains before it is verified.
 * Sentences like "Northouse Chapter 4 covers the main styles…" are dropped from unverified replies.
 */
const UNVERIFIED_CLAIM =
  /\b(?:chapter\s*\d{1,2}|ch\.?\s*\d{1,2}|(?:the|your|this)\s+(?:textbook|handout|chapter|reading))(?:\s+[^\s.!?]+){0,4}?\s+(?:covers|lists|says|includes|discusses|explains|describes|talks about|goes over|focuses on|presents|outlines|walks through|breaks down)\b/i;
export function dropChapterClaims(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((s) => !UNVERIFIED_CLAIM.test(s));
  return kept.length === parts.length ? text : kept.join(" ").trim();
}

/** A line that is only praise ("Nice!", "That tracks.") is dropped; praise with specifics stays (QA 7:11 AM). */
export function dropBarePraise(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  return t.replace(HOLLOW_PRAISE, "").trim() ? t : "";
}

/** Colton's "I'm not going to the dark web!" once per paper: later asks drop it. */
export function withoutDarkWeb(text: string | null | undefined): string {
  return (text ?? "").replace(/,?\s*and I'?m not going to the dark web!?/i, ".").replace(/\s*I'?m not going to the dark web!?/i, "").replace(/\.\./g, ".").trim();
}


/** QA 5:46: once the key points are already given, the ask is only the upload offer: no "I need the actual
 * source material" demand and no dark-web line. */
export function uploadOfferOnly(text: string | null | undefined): string {
  return withoutDarkWeb(
    (text ?? "")
      .replace(/\s*I need the actual source material(?:,?\s*and I'?m not going to the dark web)?[.!]?/i, "")
      .replace(/\s*Real talk: I don't know [^.]*?, and I won't guess\.\s*/i, " "),
  )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* --------------------------- QA 7:02 AM signals --------------------------- */

/** A typed "skip" / "next" / "pass": never an answer, never counts toward the gate. */
export function isSkipSaying(text: string): boolean {
  return /^\s*(skip( (this|it|that|this one|for now))?|next|pass|no thanks|nah|n\/?a|none|nothing|-+|\.+)\s*[.!]*\s*$/i.test(text);
}

/** "Skip the get-to-know-you questions": every get-to-know-you question goes, not just hobbies. */
export function isGetToKnowSkip(text: string): boolean {
  return /\bskip\b.{0,30}\b(get[- ]?to[- ]?know(?:[- ]?you)?|personal|about me|hobb(y|ies)|intro(ductory)?|background|small talk)\b(?: questions?)?/i.test(text);
}

/** A stance in their own words from ANY message: the stance sentence and a named leader, if there is one. */
export function parseStance(
  text: string,
  options: DecisionOption[] = [],
  people: DecisionOption[] = [],
): { stance: string; leader: string | null } | null {
  const stance = statedStance(text, options, people);
  if (!stance) return null;
  const person = people.find((p) => {
    const last = p.label.split(/\s+/).at(-1)!.toLowerCase();
    return last.length > 2 && stance.toLowerCase().includes(last);
  });
  const named =
    person?.label ??
    stance.match(/\b(?:using|with|like|such as|example(?: of)?|for example|e\.g\.?|leader(?: is)?|specifically)\s+((?:[A-Z][a-z'’-]+)(?:\s+[A-Z][a-z'’-]+){1,2})\b/)?.[1] ??
    stance.replace(/^\S+\s/, "").match(/\b([A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+)\b/)?.[1] ??
    singleNamedLeader(stance) ??
    null;
  return { stance, leader: named && !/^(The|This|My|Chapter|Northouse|Leadership)\b/.test(named) ? named : null };
}

/** Summaries built from material we actually have (their copy, a fetched page, or the sheet), never her own knowledge. */
export function verifiedSummaries(ctx: PaperContext): MaterialSummary[] {
  const ok = (x: MaterialSummary) => x.kind === "reading" || x.kind === "found" || x.kind === "assignment";
  const have = currentSummaries(ctx).filter(ok);
  const sheet = (ctx.summaries ?? []).filter((x) => x.kind === "assignment" && !have.includes(x)).slice(-1);
  return [...have, ...sheet];
}

const GENERIC_OPTION_WORD =
  /^(focus|focusing|use|using|both|equally|reading|readings|essay|paper|choose|part|side|first|more|most|less|main|idea|ideas|angle|approach|option|pick|style|styles|agree|agreeing|disagree|disagreeing|partly|partially|mixed|depends|yes|neither|either|argue|against|with|about|into|from|than|that|this|what|which|matter|matters|together|time|people|your|their)$/;
/**
 * An option is grounded when its distinctive words come from material we have or
 * the assignment text itself (QA 7:02 AM: "No phones or screens" was invented for an
 * unseen handout). Pure stance options ("Agree", "Use both equally") are fine.
 */
export function optionGrounded(label: string, corpus: string): boolean {
  const c = ` ${corpus.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ")} `;
  const words = label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 3 && !GENERIC_OPTION_WORD.test(w));
  if (!words.length) return true;
  const hit = words.filter((w) => c.includes(` ${w}`) || c.includes(` ${w.replace(/(ing|ed|es|s)$/, "")}`)).length;
  return hit / words.length > 0.5;
}

/** Options from the assignment's own question, when nothing grounded came back. */
export function assignmentOnlyOptions(text: string): DecisionOption[] {
  const t = text.replace(/\s+/g, " ");
  if (/\b(whether|if) you agree\b|\bagree or disagree\b|\bdo you agree\b/i.test(t)) {
    return [
      { label: "Agree", why: "Lets you back up the readings' point with your own reasons." },
      { label: "Disagree", why: "Lets you push back on the readings with your own reasons." },
      { label: "Partly agree", why: "Lets you keep what holds up and question the rest." },
    ];
  }
  if (/\bwhether\b|\bshould\b|\bto what extent\b/i.test(t)) {
    return [
      { label: "Yes", why: "Lets you argue for it with your strongest reasons." },
      { label: "No", why: "Lets you argue against it with your strongest reasons." },
      { label: "It depends", why: "Lets you show when it holds and when it doesn't." },
    ];
  }
  return [];
}

/**
 * QA 7:02 AM: messages that may need a lookup show "Digging it up…" the moment they're
 * sent (client side), not after the server has classified them.
 */
export function mayNeedLookup(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return false;
  return /\b(read(?:ing|ings)?|chapter|ch\.|book|textbook|article|handout|author|summar\w*|key points|what (?:is|are|does|do|did|was)|who (?:is|was|are)|explain|tell me (?:about|what)|options?|video|example|theor(?:y|ies)|styles?|model|says?|said|means?|covers?|about|research|sources?|stud(?:y|ies)|evidence|find|look(?:ing)? up|search|data|statistics?|facts?|history|leaders?|known for|(?:how|why|when|where) (?:did|does|do|is|was)|can you|could you|is there|are there|idk|no idea|not sure)\b/.test(t) || /\?\s*$/.test(t);
}

/**
 * No options she can ground (QA 7:02 AM): the decision is still asked, in the assignment's
 * own terms ("Which leadership style do you want to argue is most effective…?"), never with
 * options guessed from a reading's title.
 */
export function assignmentDecisionAsk(text: string): string | null {
  const t = (text ?? "").replace(/\s+/g, " ");
  const m = t.match(/\bwhich ([a-z][a-z -]{2,40}?) (is|are|was|works?|would be) ([^.?;,]{3,80})/i);
  if (m) {
    const what = m[1]!.trim().toLowerCase();
    return `Which ${what} do you want to argue ${m[2]!.toLowerCase().startsWith("work") ? "works" : "is"} ${m[3]!.trim().replace(/[,\s]+$/, "")}, and why? Name it in your own words.`;
  }
  // QA 1:16: concrete for a lost student ("does stress help or hurt memory?"), never "your first big choice".
  const w = t.match(/\bwhether ([a-z][^.?;,]{2,60}?) or ((?:not|[a-z])[^.?;,]{1,60})/i);
  if (w) return `Gut answer first, even a guess: ${w[1]!.trim()} or ${w[2]!.trim().replace(/\s+(with|using|and use|in|for)\b.*$/i, "")}? Pick one and give one reason. A sentence is plenty.`;
  if (/\b(whether|should|to what extent|agree)\b/i.test(t)) return "Where do you stand on the assignment's question so far, and why? Even a rough answer works.";
  return null;
}

/**
 * QA 9:37 AM: a pasted reading's key points come first, then the ask. When the model
 * summary isn't back, its own main lines stand in (their text, labeled, never invented).
 */
export function pasteKeyLines(text: string, n = 3): string[] {
  const sentences = (text ?? "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences
    .map((x) => x.trim())
    .filter((x) => x.split(" ").length >= 6)
    .slice(0, n)
    .map((x) => (x.split(" ").length > 30 ? `${x.split(" ").slice(0, 30).join(" ")}…` : x));
}

/** The reply to a pasted reading: what it is, its key points, then what they make of it. */
export function pastedReadingParas(opts: { title: string; summary: MaterialSummary | null; text: string; tail: string }): string[] {
  const named = opts.title !== "Pasted reading" ? ` (${opts.title})` : "";
  const points = opts.summary
    ? summaryParas(opts.summary).slice(0, 6)
    : (() => {
        const lines = pasteKeyLines(opts.text);
        return lines.length ? ["The main lines from what you pasted:", ...lines.map((l) => `• ${l}`)] : [];
      })();
  return [`That looks like part of the reading${named}, so I saved it as material for this paper instead of as your answer.`, ...points, opts.tail];
}

/**
 * QA 9:37 AM: what they actually picked, in their words ("their own" is a placeholder,
 * never shown): the named option, else the part of their answer before the reason.
 */
export function decisionLabel(d: { pick?: string | null; answer?: string | null } | null | undefined): string | null {
  if (!d) return null;
  if (d.pick && d.pick !== "their own") return d.pick;
  const a = (d.answer ?? "").replace(/\s+/g, " ").trim();
  const head = (a.split(/\b(?:because|since|bc|cuz)\b/i)[0] ?? "")
    .replace(/^(?:yeah|ok(?:ay)?|so|um+|well|honestly),?\s+/i, "")
    .replace(/^(?:i(?:'d| would)? (?:pick|go with|choose|argue(?: that)?|want to argue(?: that)?)|i(?:'m| am) going with|i think|my pick is)\s+/i, "")
    .replace(/[\s,.;:!]+$/, "")
    .trim();
  if (!head || head.split(" ").length > 10) return null;
  return head;
}


const STYLE_WORDS = ["transformational", "servant", "situational", "transactional", "democratic", "autocratic", "authentic", "laissez-faire", "charismatic", "behavioral", "participative", "adaptive", "path-goal", "coaching", "visionary"];

/**
 * QA 1:11 AM #7: every style/option they picked, in the order they said them
 * ("servant and transformational" → ["Servant", "Transformational"]), never just the first.
 */
// "Servant leadership" (an option) and "Servant" (a style word) are one pick, never listed twice.
const firstWord = (x: string) => x.toLowerCase().split(/\s+/)[0] ?? "";
export function pickedStyles(decision: { pick?: string | null; answer?: string | null } | null | undefined, options: DecisionOption[] = []): string[] {
  if (!decision) return [];
  const said = `${decision.answer ?? ""}`.toLowerCase();
  const hits: { at: number; label: string }[] = [];
  const add = (word: string, label: string) => {
    const m = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").exec(said);
    // QA prod smoke (64a5b2bd): "Servant, not transformational" picks servant only.
    if (m && affirmsStyle(said, word) && !hits.some((h) => h.label.toLowerCase() === label.toLowerCase() || firstWord(h.label) === firstWord(label))) hits.push({ at: m.index, label });
  };
  for (const o of options) {
    const head = o.label.split(/[:(–]/)[0]!.trim();
    // A whole label ("team management"), never one shared word like "team" (QA 6:03 follow-up).
    if (head.length > 3) add(head.toLowerCase(), head);
  }
  for (const w of STYLE_WORDS) add(w, w.charAt(0).toUpperCase() + w.slice(1));
  hits.sort((a, b) => a.at - b.at);
  const out = hits.map((h) => h.label);
  const pick = decision.pick && decision.pick !== "their own" ? decision.pick.split(/[:(–]/)[0]!.trim() : null;
  if (pick && decision.pick && answerNamesOption(decision.answer ?? "", decision.pick) && !out.some((x) => x.toLowerCase().startsWith(pick.toLowerCase().split(" ")[0]!))) out.unshift(pick);
  return out.slice(0, 4);
}

/**
 * PC-30 QA #5: what they picked, as a phrase: every style they chose, joined naturally
 * ("servant and transformational leadership"), never just the first. One pick: as before.
 */
export function pickPhrase(decision: { pick?: string | null; answer?: string | null } | null | undefined, options: DecisionOption[] = []): string | null {
  if (!decision) return null;
  const styles = pickedStyles(decision, options);
  if (styles.length >= 2) {
    const isStyle = (s: string) => STYLE_WORDS.includes(s.toLowerCase());
    const words = styles.map((s) => (isStyle(s) ? s.toLowerCase() : s));
    return styles.every(isStyle) ? `${andList(words)} leadership` : andList(words);
  }
  return decisionLabel(decision);
}

/** Their leader or example person, from the leader pick or named in the decision. */
export function pickedLeader(ctx: Pick<PaperContext, "leader" | "decision" | "options"> | null | undefined): string | null {
  if (!ctx) return null;
  const pick = ctx.leader?.pick && ctx.leader.pick !== "their own" ? ctx.leader.pick : null;
  if (pick && pick.split(" ").length <= 5) return pick;
  for (const text of [ctx.leader?.answer, ctx.decision?.answer]) {
    if (!text) continue;
    const parsed = parseStance(text, ctx.options?.options ?? [], ctx.options?.people ?? []);
    if (parsed?.leader) return parsed.leader;
  }
  return null;
}

/** "A", "A and B", "A, B and C". */
export function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
