import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAssignmentConfirmGate } from "@/lib/assignment/confirm";
import { formatLengthLabel } from "@/lib/assignment/pages-to-words";
import { assignmentRequirementsSchema } from "@/lib/assignment/schema";
import { resolveReaderMode } from "@/lib/auth/reader-mode";
import { clearDemoSession, getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { ensureUserPaper } from "@/lib/papers/account";
import { coerceDueDate } from "@/lib/papers/funding";
import { logSessionEvent } from "@/lib/session-events";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  requirements: assignmentRequirementsSchema,
  aiPolicyAck: z.boolean().optional(),
  selectedCandidateId: z.string().optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { paperId } = await ctx.params;
  if (!z.string().uuid().safeParse(paperId).success) {
    return NextResponse.json({ error: "Invalid paper id" }, { status: 400 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const gate = assertAssignmentConfirmGate(body.requirements);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Confirm gate failed", reasons: gate.reasons },
      { status: 400 },
    );
  }

  const requirements = gate.requirements;
  const policy = requirements.aiPolicy.value;
  if (
    (policy === "forbidden" || policy === "restricted") &&
    !body.aiPolicyAck
  ) {
    return NextResponse.json(
      {
        error: "AI policy acknowledgement required",
        needsAiPolicyAck: true,
      },
      { status: 400 },
    );
  }

  const paperPatch = {
    title:
      requirements.topic.value ||
      requirements.promptQuestion.value ||
      null,
    course: requirements.course.value,
    due_date: coerceDueDate(requirements.dueDate.value),
    required_length: formatLengthLabel(requirements.length.value),
    citation_style:
      requirements.citationStyle.value === "other"
        ? requirements.citationStyleOther ?? "other"
        : requirements.citationStyle.value,
  };

  await logSessionEvent({
    paperId,
    stage: 1,
    event: body.aiPolicyAck ? "ai_policy_continued" : "assignment_confirmed",
    detail: {
      aiPolicy: policy ?? "unspecified",
      selectedCandidateId: body.selectedCandidateId ?? null,
    },
  });

  const demo = await getDemoSession();
  let authenticated = false;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
    if (user) await clearDemoSession();

    if (resolveReaderMode({ authenticated, demoSession: Boolean(demo) }) === "live" && user) {
      const ensured = await ensureUserPaper(supabase, user.id, paperId);
      if (!ensured.ok) {
        return NextResponse.json({ error: ensured.error }, { status: ensured.status });
      }

      const now = new Date().toISOString();
      const { error: assignmentError } = await supabase.from("assignments").upsert(
        {
          paper_id: paperId,
          user_id: user.id,
          requirements,
          confirmed_at: now,
          ai_policy_ack_at: body.aiPolicyAck ? now : null,
          field_confirmations: {},
        },
        { onConflict: "paper_id" },
      );

      if (assignmentError) {
        console.error("[assignment/confirm] save failed", {
          paperId,
          code: assignmentError.code,
        });
        return NextResponse.json(
          { error: "We couldn't save this assignment. Please try again." },
          { status: 500 },
        );
      }

      const { data: paper } = await supabase
        .from("papers")
        .select("title")
        .eq("id", paperId)
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase
        .from("papers")
        .update({
          ...paperPatch,
          title: paper?.title || paperPatch.title,
          updated_at: now,
        })
        .eq("id", paperId)
        .eq("user_id", user.id);

      return NextResponse.json({
        ok: true,
        paperPatch,
        confirmedAt: now,
        aiPolicyAckAt: body.aiPolicyAck ? now : null,
      });
    }
  }

  if (resolveReaderMode({ authenticated, demoSession: Boolean(demo) }) !== "demo" && hasSupabaseConfig()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    demo: true,
    paperPatch,
    confirmedAt: new Date().toISOString(),
    aiPolicyAckAt: body.aiPolicyAck ? new Date().toISOString() : null,
  });
}
