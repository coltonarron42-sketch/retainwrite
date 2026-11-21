import { assignmentRequirementsSchema, type AssignmentRequirements } from "@/lib/assignment/schema";
import type { DemoPaper } from "@/lib/demo/store";
import { initialStageProgress } from "@/lib/stages/assert";
import { createClient } from "@/lib/supabase/server";

export async function listAccountPapers(userId: string): Promise<DemoPaper[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("papers")
    .select(
      "id, title, course, due_date, assignment_prompt, required_length, citation_style, is_free_paper, funded_by, audio_unlocked, current_stage",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    course: row.course,
    due_date: row.due_date,
    assignment_prompt: row.assignment_prompt,
    required_length: row.required_length,
    citation_style: row.citation_style,
    is_free_paper: row.is_free_paper,
    funded_by: row.funded_by,
    audio_unlocked: row.audio_unlocked,
    current_stage: row.current_stage,
    stage_progress: initialStageProgress().map((stage) => ({
      ...stage,
      status:
        stage.stage < row.current_stage
          ? ("complete" as const)
          : stage.stage === row.current_stage
            ? ("in_progress" as const)
            : ("locked" as const),
      data: {},
    })),
  }));
}

export async function loadAccountPaper(userId: string, paperId: string): Promise<{
  paper: DemoPaper;
  requirements: AssignmentRequirements | null;
  rawText: string;
} | null> {
  const supabase = await createClient();
  const { data: paper } = await supabase
    .from("papers")
    .select(
      "id, title, course, due_date, assignment_prompt, required_length, citation_style, is_free_paper, funded_by, audio_unlocked, current_stage",
    )
    .eq("id", paperId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!paper) return null;

  const { data: stages } = await supabase
    .from("stage_progress")
    .select("stage, status, data")
    .eq("paper_id", paperId)
    .eq("user_id", userId);

  const { data: assignment } = await supabase
    .from("assignments")
    .select("requirements, raw_text, confirmed_at")
    .eq("paper_id", paperId)
    .eq("user_id", userId)
    .maybeSingle();

  const parsed = assignment
    ? assignmentRequirementsSchema.safeParse(assignment.requirements)
    : null;

  const progress = initialStageProgress().map((stage) => {
    const saved = stages?.find((row) => row.stage === stage.stage);
    return {
      stage: stage.stage,
      status: saved?.status ?? stage.status,
      data: (saved?.data as Record<string, unknown>) ?? {},
    };
  });

  return {
    paper: {
      id: paper.id,
      title: paper.title,
      course: paper.course,
      due_date: paper.due_date,
      assignment_prompt: paper.assignment_prompt,
      required_length: paper.required_length,
      citation_style: paper.citation_style,
      is_free_paper: paper.is_free_paper,
      funded_by: paper.funded_by,
      audio_unlocked: paper.audio_unlocked,
      current_stage: paper.current_stage,
      stage_progress: progress,
    },
    requirements: parsed?.success ? parsed.data : null,
    rawText: assignment?.raw_text ?? "",
  };
}
