import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import {
  finalStanceIntent,
  needsModel,
  parseStanceIntent,
  rulesStanceIntent,
  STANCE_INTENT_SCHEMA,
  STANCE_INTENT_SYSTEM,
  type StanceIntent,
} from "@/lib/stages/stance-intent";
import { hasAuthCookie, paperOwnerDenied } from "@/lib/auth/paper-access";

export const runtime = "nodejs";

/** Under the client cap (STANCE_INTENT_CLIENT_MS) so the server answers first. */
const INTENT_MODEL_TIMEOUT_MS = 1_800;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  ask: z.string().max(1000).optional(),
  section: z.string().max(200).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Stage 2/3: is the student's message content, or a request/question to the
 * coach? Requests are never saved as notes. Rules are the fallback.
 * // SOP: coaching only, never generate submission text
 */
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
  const rules = rulesStanceIntent(body.message);
  // A clear request/question is final on the rules (finalStanceIntent), so no model call.
  if (rules !== "content" || !needsModel(body.message)) return NextResponse.json({ intent: rules, source: "rules" });

  const demo = await getDemoSession();
  if (!demo && !hasSupabaseConfig()) return NextResponse.json({ intent: rules, source: "rules" });
  // Typed-send latency (QA 8:08 PM): the owner check and the model call run
  // side by side; the model answer is dropped if the check fails.
  const denied = demo ? Promise.resolve(null) : paperOwnerDenied(paperId);
  const call = demo || (await hasAuthCookie()) ? classify(body) : null;
  const deny = await denied;
  if (deny) return deny;
  const model = call ? await call : null;
  return NextResponse.json({ intent: finalStanceIntent(model, rules), source: model ? "model" : "rules" });
}

async function classify(body: z.infer<typeof bodySchema>): Promise<StanceIntent | null> {
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: STANCE_INTENT_SYSTEM,
    user: JSON.stringify({ coach_asked: body.ask ?? "", section: body.section ?? "", student_message: body.message }),
    jsonSchema: { name: "stance_intent", schema: STANCE_INTENT_SCHEMA as unknown as Record<string, unknown> },
    timeoutMs: INTENT_MODEL_TIMEOUT_MS,
  });
  if (!res.ok) return null;
  try {
    return parseStanceIntent(JSON.parse(res.text));
  } catch {
    return null;
  }
}
