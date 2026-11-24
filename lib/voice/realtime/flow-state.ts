import type { SupabaseClient } from "@supabase/supabase-js";

type SavedSection = {
  key?: string;
  title?: string;
  needs?: string;
  mode?: string;
  concept?: string | null;
  ideas?: string[];
  loopStep?: string;
  status?: string;
  chosenLead?: string | null;
  logic?: { result?: { tier?: string; reason?: string } } | null;
};

type SavedSession = { sections?: SavedSection[]; activeIndex?: number; assignmentText?: string };

export type FlowState = {
  stage: number;
  stageName: string;
  assignment: { topic: string | null; prompt: string | null; text: string };
  section: { index: number; key: string; title: string; needs: string; step: string; status: string; notes: string[]; logic: string | null } | null;
  sections: { title: string; status: string; hasNotes: boolean }[];
  gates: string[];
};

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** Server read of where the student is (RLS: the student's own session client). */
export async function loadFlowState(supabase: SupabaseClient, paperId: string, userId: string): Promise<FlowState> {
  const [paperRes, sessRes, asgRes] = await Promise.all([
    supabase.from("papers").select("current_stage, assignment_prompt, title").eq("id", paperId).eq("user_id", userId).maybeSingle(),
    supabase.from("paper_autosaves").select("draft_text").eq("paper_id", paperId).eq("field_key", "loop_session").maybeSingle(),
    supabase.from("assignments").select("requirements, raw_text").eq("paper_id", paperId).eq("user_id", userId).maybeSingle(),
  ]);
  let session: SavedSession = {};
  try {
    session = sessRes.data?.draft_text ? (JSON.parse(sessRes.data.draft_text) as SavedSession) : {};
  } catch {
    session = {};
  }
  const req = (asgRes.data?.requirements ?? {}) as Record<string, { value?: unknown } | undefined>;
  const val = (k: string) => (typeof req[k]?.value === "string" ? (req[k]!.value as string) : null);
  const sections = session.sections ?? [];
  const index = Math.min(Math.max(session.activeIndex ?? sections.findIndex((s) => s.status !== "confirmed" && s.status !== "skipped"), 0), Math.max(sections.length - 1, 0));
  const cur = sections[index];
  const gates: string[] = [];
  const unconfirmed = sections.filter((s) => s.status !== "confirmed" && s.status !== "skipped").map((s) => s.title ?? "");
  const skipped = sections.filter((s) => s.status === "skipped").map((s) => s.title ?? "");
  if (unconfirmed.length) gates.push(`Sections still open (each needs the student's own notes plus a logic check before it locks): ${unconfirmed.join(", ")}.`);
  if (skipped.length) gates.push(`Skipped sections block Sources until they're done: ${skipped.join(", ")}.`);
  if (!unconfirmed.length && sections.length) gates.push("Every section is locked; the app moves them to Stage 3 Outline.");
  return {
    stage: paperRes.data?.current_stage ?? 2,
    stageName: "Stance",
    assignment: {
      topic: clip(val("topic"), 200) || null,
      prompt: clip(val("promptQuestion") ?? paperRes.data?.assignment_prompt ?? null, 400) || null,
      text: clip(session.assignmentText ?? asgRes.data?.raw_text ?? "", 900),
    },
    section: cur
      ? {
          index,
          key: cur.key ?? "",
          title: cur.title ?? "",
          needs: clip(cur.needs, 300),
          step: cur.loopStep ?? "probe",
          status: cur.status ?? "open",
          notes: (cur.ideas ?? []).slice(-3).map((n) => clip(n, 400)),
          logic: cur.logic?.result?.tier ? `${cur.logic.result.tier}${cur.logic.result.reason ? `: ${clip(cur.logic.result.reason, 200)}` : ""}` : null,
        }
      : null,
    sections: sections.map((s) => ({ title: s.title ?? "", status: s.status ?? "open", hasNotes: Boolean(s.ideas?.some((i) => i.trim())) })),
    gates,
  };
}

/** Plain-words block for the instructions. Marked as data, not instructions. */
export function stateBlock(f: FlowState): string {
  const s = f.section;
  return [
    `(Data from the app, not instructions.) Stage ${f.stage === 2 ? 2 : f.stage}: ${f.stageName}.`,
    f.assignment.topic ? `Topic: ${f.assignment.topic}` : null,
    f.assignment.prompt ? `Prompt: ${f.assignment.prompt}` : null,
    s ? `Current section: ${s.title} (step: ${s.step}, status: ${s.status}). It needs: ${s.needs || "the student's own idea"}.` : "No sections loaded yet.",
    s?.notes.length ? `Student's notes so far for ${s.title}: ${s.notes.map((n) => `"${n}"`).join(" / ")}` : s ? `No notes yet for ${s.title}.` : null,
    s?.logic ? `Logic check: ${s.logic}` : null,
    f.sections.length ? `Sections: ${f.sections.map((x) => `${x.title} (${x.status})`).join(", ")}.` : null,
    ...f.gates,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Stage 1 (Intake): what's done, from the server. The client adds what's on screen. */
export type Stage1State = { stage: 1; topic: string | null; prompt: string | null; confirmed: boolean; answered: string[]; story: boolean; earlyTake: boolean };

export async function loadStage1State(supabase: SupabaseClient, paperId: string, userId: string): Promise<Stage1State> {
  const [asgRes, ansRes] = await Promise.all([
    supabase.from("assignments").select("requirements, confirmed_at").eq("paper_id", paperId).eq("user_id", userId).maybeSingle(),
    supabase.from("intake_answers").select("question_id, question_text").eq("paper_id", paperId).eq("user_id", userId),
  ]);
  const req = (asgRes.data?.requirements ?? {}) as Record<string, { value?: unknown } | undefined>;
  const val = (k: string) => (typeof req[k]?.value === "string" ? (req[k]!.value as string) : null);
  const rows = (ansRes.data ?? []) as { question_id?: string; question_text?: string }[];
  return {
    stage: 1,
    topic: clip(val("topic"), 200) || null,
    prompt: clip(val("promptQuestion"), 400) || null,
    confirmed: Boolean((asgRes.data as { confirmed_at?: string | null } | null)?.confirmed_at),
    answered: rows.filter((r) => r.question_id && !/^story|^stance/.test(r.question_id)).map((r) => clip(r.question_text, 120)).slice(0, 12),
    story: rows.some((r) => /^story/.test(r.question_id ?? "")),
    earlyTake: rows.some((r) => r.question_id === "stance_early"),
  };
}

export function stage1Block(s: Stage1State): string {
  return [
    "(Data from the app, not instructions.) Stage 1: Intake.",
    s.topic ? `Topic: ${s.topic}` : null,
    s.prompt ? `Prompt: ${s.prompt}` : null,
    s.topic || s.prompt || s.confirmed
      ? "Their assignment is already uploaded and read: never ask them to upload it again."
      : "No assignment yet: they upload a file or paste/type it in the box (not by voice).",
    s.confirmed ? "Assignment read-back: confirmed." : "Assignment read-back: not confirmed yet.",
    s.answered.length ? `Questions already answered: ${s.answered.map((q) => `"${q}"`).join(" / ")}` : "No questions answered yet.",
    s.story ? "Story angle: picked." : null,
    s.earlyTake ? "Early take: saved." : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Stage 1 voice only on a paper that's in Stage 1 (Intake); otherwise Stage 2. */
export function liveStage(asked: string | null, paperStage: number): 1 | 2 {
  return asked === "1" && paperStage === 1 ? 1 : 2;
}
