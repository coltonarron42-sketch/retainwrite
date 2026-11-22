/**
 * The student's natural reply to Pau Pau's read-back (PLAN.md 9): no "Fix
 * something" button. Each reply is classified as confirm, question,
 * correction, extra info, or ambiguous. Pau Pau only moves on after a clear
 * confirm. Corrections update the extracted fields and Pau Pau re-confirms.
 * SOP: coaching only. Replies talk about the assignment sheet, never the paper.
 */
import { markFieldConfirmed } from "@/lib/assignment/confirm-helpers";
import { emptyField, type AssignmentRequirements, type CitationStyle } from "@/lib/assignment/schema";
import { lengthFromAnswer, type PauPauAsk } from "@/lib/stage1/pau-pau";

export type ConfirmIntent = "confirm" | "question" | "correction" | "extra_info" | "ambiguous";

export type ConfirmUpdates = {
  topic: string | null;
  promptQuestion: string | null;
  course: string | null;
  instructor: string | null;
  paperType: string | null;
  dueDate: string | null;
  citationStyle: string | null;
  wordsMin: number | null;
  wordsMax: number | null;
  pagesMin: number | null;
  pagesMax: number | null;
  sourcesMin: number | null;
};

export type ConfirmResult = {
  intent: ConfirmIntent;
  /** Pau Pau's short answer in her own voice. */
  reply: string;
  updates: ConfirmUpdates;
  /** Keep the student's message, verbatim, as an extra note on the assignment. */
  keepAsNote: boolean;
  /** The student says they don't have / don't want to give the thing Pau Pau asked for. */
  skipAsk: boolean;
};

export type ConfirmTurn =
  | { role: "student"; text: string }
  | {
      role: "pau";
      paras: string[];
      /** What this reply changed on the card, so a reload rebuilds the same card. */
      apply?: { updates?: ConfirmUpdates; note?: string };
      /** The ask the student declined or answered in this exchange. */
      skip?: PauPauAsk;
    };

/** Re-applies saved corrections and notes (a reload before confirming). */
export function replayTurns(req: AssignmentRequirements, turns: ConfirmTurn[]): AssignmentRequirements {
  let next = req;
  for (const t of turns) {
    if (t.role !== "pau" || !t.apply) continue;
    if (t.apply.updates) next = applyConfirmUpdates(next, t.apply.updates);
    if (t.apply.note) next = appendStudentNote(next, t.apply.note);
  }
  return next;
}

export function parseConfirmTurns(raw: string | null | undefined): ConfirmTurn[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (t): t is ConfirmTurn =>
        Boolean(t) &&
        typeof t === "object" &&
        (((t as ConfirmTurn).role === "student" && typeof (t as { text?: unknown }).text === "string") ||
          ((t as ConfirmTurn).role === "pau" && Array.isArray((t as { paras?: unknown }).paras))),
    );
  } catch {
    return [];
  }
}

/** Keeps the saved conversation small. */
export function trimTurns(turns: ConfirmTurn[]): ConfirmTurn[] {
  return turns.slice(-30).map((t) =>
    t.role === "student" ? { ...t, text: t.text.slice(0, 2000) } : { ...t, paras: t.paras.slice(0, 12).map((p) => p.slice(0, 2000)) },
  );
}

export const CONFIRM_CHAT_FIELD = "intake:confirm-chat";

export function emptyUpdates(): ConfirmUpdates {
  return {
    topic: null,
    promptQuestion: null,
    course: null,
    instructor: null,
    paperType: null,
    dueDate: null,
    citationStyle: null,
    wordsMin: null,
    wordsMax: null,
    pagesMin: null,
    pagesMax: null,
    sourcesMin: null,
  };
}

export function hasUpdates(u: ConfirmUpdates): boolean {
  return Object.values(u).some((v) => v !== null && v !== "");
}

const QUICK_CONFIRM =
  /^(?:(?:yes|yep|yeah|yup|ya|yes ma'?am|sure|ok(?:ay)?|k|alright|correct|right|perfect|great|awesome|cool|exactly|definitely|ready)(?:[,!. ]+(?:that'?s (?:right|correct|it)|looks (?:good|great|right)|let'?s go|i'?m ready|ready|sounds good))*|(?:it |that |this |everything |all )?looks? (?:good|great|right|correct|fine|perfect)(?: to me)?|all good|all correct|that'?s (?:right|correct|it|perfect)|you got it|nailed it|good to go|sounds (?:good|great|right)|let'?s (?:go|do (?:it|this)|get rolling|roll|start)|i'?m ready)[.! ]*(?:👍)?$/i;

/** Plain "looks good" / "yes" / "let's go": no model call needed. */
export function isQuickConfirm(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > 60) return false;
  return QUICK_CONFIRM.test(t);
}

const CITATION: Array<[RegExp, CitationStyle]> = [
  [/\bmla\b/i, "MLA 9"],
  [/\bapa\b/i, "APA 7"],
  [/\bchicago\b.*\bauthor[- ]date\b/i, "Chicago 17 Author-Date"],
  [/\bchicago\b|\bturabian\b/i, "Chicago 17 Notes"],
  [/\bharvard\b/i, "Harvard"],
  [/\bieee\b/i, "IEEE"],
  [/\bama\b/i, "AMA"],
];

export function citationFrom(text: string | null | undefined): CitationStyle | null {
  if (!text) return null;
  for (const [re, style] of CITATION) if (re.test(text)) return style;
  return null;
}

const URL_RE = /https?:\/\/[^\s<>"']+\.[^\s<>"']+/i;
export function linkIn(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[).,;!?]+$/, "") : null;
}

/**
 * Rule-based reading when the model is unavailable. Conservative: anything it
 * can't place is "ambiguous", so Pau Pau asks instead of moving on.
 */
export function rulesClassify(text: string, pendingAsk: PauPauAsk | null): ConfirmResult {
  const t = text.replace(/\s+/g, " ").trim();
  const updates = emptyUpdates();
  const base = { keepAsNote: false, skipAsk: false };
  if (isQuickConfirm(t)) return { ...base, intent: "confirm", reply: "Great.", updates };
  if (pendingAsk && /^(no|nope|nah|not (?:yet|now|really)|i don'?t (?:have|know)|none|skip)\b/i.test(t)) {
    return { ...base, skipAsk: true, intent: "extra_info", reply: "No problem, we can do without it for now.", updates };
  }
  const len = /\b\d[\d,]*\s*(?:-|–|to)?\s*\d*[\d,]*\s*(?:words?|pages?)\b/i.test(t) || pendingAsk === "length" ? lengthFromAnswer(t) : null;
  if (len?.wordsMin || len?.pagesMin) {
    updates.wordsMin = len.wordsMin ?? null;
    updates.wordsMax = len.wordsMax ?? null;
    updates.pagesMin = len.pagesMin ?? null;
    updates.pagesMax = len.pagesMax ?? null;
  }
  const due = t.match(/\bdue(?: date)?(?: is| on|:)?\s+([A-Za-z]{3,9}\.? \d{1,2}(?:st|nd|rd|th)?(?:,? \d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:next )?(?:mon|tues|wednes|thurs|fri|satur|sun)day)/i);
  if (due) updates.dueDate = due[1]!.replace(/\s+/g, " ").trim();
  const cite = /\b(?:mla|apa|chicago|turabian|harvard|ieee|ama)\b/i.test(t) ? citationFrom(t) : null;
  if (cite) updates.citationStyle = cite;
  const sources = t.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:scholarly |peer[- ]reviewed |academic )?(?:sources|references|citations)\b/i);
  if (sources) {
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    const n = /\d/.test(sources[1]!) ? Number(sources[1]) : words.indexOf(sources[1]!.toLowerCase());
    if (n > 0) updates.sourcesMin = n;
  }
  if (pendingAsk === "topic" && !hasUpdates(updates) && t.split(" ").length >= 3 && !/\?$/.test(t)) {
    updates.topic = t;
  }
  if (hasUpdates(updates)) return { ...base, intent: "correction", reply: "Got it, I've updated that.", updates };
  if (/\?\s*$/.test(t)) {
    return {
      ...base,
      intent: "question",
      reply: "Good question. I can only go by what's on the sheet, so if it isn't there, your teacher is the best person to ask.",
      updates,
    };
  }
  return {
    ...base,
    intent: "ambiguous",
    reply: "Just to be sure I've got it: does everything above look right, or is there something I should change?",
    updates,
  };
}

/** Writes the changes onto the card as student-confirmed values. */
export function applyConfirmUpdates(req: AssignmentRequirements, u: ConfirmUpdates): AssignmentRequirements {
  const next = { ...req };
  const str = (v: string | null, max = 300) => (v && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);
  const topic = str(u.topic, 500);
  if (topic) next.topic = markFieldConfirmed(req.topic, { value: topic });
  const prompt = str(u.promptQuestion, 1000);
  if (prompt) next.promptQuestion = markFieldConfirmed(req.promptQuestion, { value: prompt });
  const course = str(u.course, 120);
  if (course) next.course = markFieldConfirmed(req.course, { value: course });
  const instructor = str(u.instructor, 80);
  if (instructor) {
    next.instructor = markFieldConfirmed(
      req.instructor ?? emptyField<string>(),
      { value: instructor },
    );
  }
  const type = str(u.paperType, 60);
  if (type) next.paperType = markFieldConfirmed(req.paperType, { value: type });
  const due = str(u.dueDate, 60);
  if (due) next.dueDate = markFieldConfirmed(req.dueDate, { value: due });
  const cite = citationFrom(u.citationStyle);
  if (cite) next.citationStyle = markFieldConfirmed(req.citationStyle, { value: cite });
  const pos = (n: number | null) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined);
  const wordsMin = pos(u.wordsMin);
  const pagesMin = pos(u.pagesMin);
  if (wordsMin || pagesMin) {
    const wordsMax = pos(u.wordsMax) ?? wordsMin;
    const pagesMax = pos(u.pagesMax) ?? pagesMin;
    const raw = wordsMin
      ? `${wordsMin === wordsMax ? wordsMin : `${wordsMin}-${wordsMax}`} words`
      : `${pagesMin === pagesMax ? pagesMin : `${pagesMin}-${pagesMax}`} pages`;
    next.length = markFieldConfirmed(req.length, {
      value: wordsMin ? { wordsMin, wordsMax, raw } : { pagesMin, pagesMax, raw },
    });
  }
  const sources = pos(u.sourcesMin);
  if (sources) {
    next.requiredSources = markFieldConfirmed(req.requiredSources, {
      value: { ...(req.requiredSources.value ?? {}), countMin: sources },
    });
  }
  return next;
}

/** Adds the student's own words, unchanged, to the assignment's extra instructions. */
export function appendStudentNote(req: AssignmentRequirements, text: string): AssignmentRequirements {
  const note = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!note) return req;
  const have = req.otherInstructions.value?.trim();
  const value = have ? `${have}\nStudent note: ${note}` : `Student note: ${note}`;
  return { ...req, otherInstructions: markFieldConfirmed(req.otherInstructions, { value }) };
}

export const CONFIRM_REPLY_SYSTEM = `You are Pau Pau, a warm writing coach for students. You just read back a student's assignment sheet to them and asked if you got it right. Now classify the student's reply and answer it.

Intents:
- "confirm": the student clearly says the read-back is right / they're ready (e.g. "looks good", "yes", "yep that's it"). Only if nothing needs changing.
- "correction": the student corrects or adds a detail you track (topic, prompt question, course, instructor, paper type, due date, citation style, length in words or pages, number of sources). Put ONLY the changed values in "updates"; every other update is null. A reply that confirms AND corrects is a correction.
- "question": the student asks you something (e.g. "do you need my due date?", "what does the rubric focus on?"). Answer from the assignment details given. If the sheet doesn't say, say so plainly and suggest asking their teacher.
- "extra_info": the student shares context that isn't a tracked field (e.g. "my teacher said first person is fine"). Set keepAsNote true so their exact words are saved. If they decline what you asked for ("I don't have the sources yet"), set skipAsk true.
- "ambiguous": you can't tell what they mean. Ask one short clarifying question. Never treat an unclear reply as confirm.

The reply: 1-3 short, warm, plain sentences in Pau Pau's own voice. No exclamation points. Do not restate the whole assignment. For a correction, briefly name what you changed ("Got it, 1,500 words and due Dec 3."). Do not ask "does it look right" at the end; the app adds that.
Coaching only: never write any part of the student's paper. No thesis, outline, arguments, example sentences, or paragraphs. Never invent assignment details.
Dates: keep them as the student wrote them ("Dec 3"). citationStyle must be one of: "APA 7", "MLA 9", "Chicago 17 Notes", "Chicago 17 Author-Date", "Harvard", "IEEE", "AMA", or null.`;

const nullable = (type: "string" | "number") => ({ type: [type, "null"] });

export const CONFIRM_REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["confirm", "question", "correction", "extra_info", "ambiguous"] },
    reply: { type: "string" },
    keepAsNote: { type: "boolean" },
    skipAsk: { type: "boolean" },
    updates: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: nullable("string"),
        promptQuestion: nullable("string"),
        course: nullable("string"),
        instructor: nullable("string"),
        paperType: nullable("string"),
        dueDate: nullable("string"),
        citationStyle: nullable("string"),
        wordsMin: nullable("number"),
        wordsMax: nullable("number"),
        pagesMin: nullable("number"),
        pagesMax: nullable("number"),
        sourcesMin: nullable("number"),
      },
      required: [
        "topic",
        "promptQuestion",
        "course",
        "instructor",
        "paperType",
        "dueDate",
        "citationStyle",
        "wordsMin",
        "wordsMax",
        "pagesMin",
        "pagesMax",
        "sourcesMin",
      ],
    },
  },
  required: ["intent", "reply", "keepAsNote", "skipAsk", "updates"],
} as const;

/** Compact view of the card for the model: values only. */
export function cardForModel(req: AssignmentRequirements): Record<string, unknown> {
  const v = <T>(f: { value: T | null } | undefined) => f?.value ?? null;
  return {
    course: v(req.course),
    instructor: v(req.instructor),
    paperType: v(req.paperType),
    topic: v(req.topic),
    promptQuestion: v(req.promptQuestion),
    length: v(req.length),
    citationStyle: req.citationStyle.value === "other" ? req.citationStyleOther ?? "other" : v(req.citationStyle),
    dueDate: v(req.dueDate),
    requiredSources: v(req.requiredSources),
    providedReadings: (req.providedReadings.value ?? []).map((r) => r.title ?? r.url ?? "").filter(Boolean).slice(0, 8),
    structure: (req.structuralRequirements.value ?? []).slice(0, 12),
    formatting: (req.formattingRules.value ?? []).slice(0, 12),
    rubric: (req.rubricCriteria.value ?? []).map((c) => c.name).slice(0, 12),
    otherInstructions: v(req.otherInstructions)?.slice(0, 800) ?? null,
    aiPolicy: v(req.aiPolicy),
  };
}

export function confirmUserPrompt(input: {
  card: Record<string, unknown>;
  sheetExcerpt?: string;
  pendingAsk: PauPauAsk | null;
  history: ConfirmTurn[];
  message: string;
}): string {
  const history = input.history
    .slice(-6)
    .map((t) => (t.role === "student" ? `Student: ${t.text}` : `Pau Pau: ${t.paras.join(" ")}`))
    .join("\n");
  return [
    `Assignment details you extracted (JSON): ${JSON.stringify(input.card)}`,
    input.sheetExcerpt ? `Assignment sheet text (excerpt):\n"""${input.sheetExcerpt.slice(0, 6000)}"""` : "",
    input.pendingAsk ? `You also asked the student for: ${input.pendingAsk}.` : "",
    history ? `Conversation so far:\n${history}` : "",
    `Student's reply: """${input.message}"""`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Validates a model result; anything off falls back to the rules. */
export function parseModelResult(raw: unknown): ConfirmResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ConfirmResult> & { updates?: Partial<ConfirmUpdates> };
  const intents: ConfirmIntent[] = ["confirm", "question", "correction", "extra_info", "ambiguous"];
  if (!r.intent || !intents.includes(r.intent)) return null;
  const reply = typeof r.reply === "string" ? r.reply.replace(/\s+/g, " ").trim().slice(0, 600) : "";
  if (!reply) return null;
  const updates = emptyUpdates();
  for (const key of Object.keys(updates) as (keyof ConfirmUpdates)[]) {
    const val = r.updates?.[key];
    if (typeof val === "string" && val.trim()) (updates as Record<string, unknown>)[key] = val.trim();
    else if (typeof val === "number" && Number.isFinite(val)) (updates as Record<string, unknown>)[key] = val;
  }
  let intent = r.intent;
  // A "correction" with nothing to change is really unclear; never advance on it.
  if (intent === "correction" && !hasUpdates(updates)) intent = "ambiguous";
  // A confirm that carries changes is a correction, so Pau Pau re-confirms first.
  if (intent === "confirm" && hasUpdates(updates)) intent = "correction";
  return { intent, reply: reply.replace(/!/g, "."), updates, keepAsNote: Boolean(r.keepAsNote), skipAsk: Boolean(r.skipAsk) };
}
