import { NextResponse } from "next/server";
import { z } from "zod";
import { grokChatJson, MODEL_FAST } from "@/lib/ai/grok";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { hasAuthCookie, paperOwnerDenied } from "@/lib/auth/paper-access";
import {
  exploreReply,
  listeningClaim,
  parseListenModelClaim,
  parseListenModelReply,
} from "@/lib/stages/explore-intent";

export const runtime = "nodejs";

/** Give the model a real chance; the client cap is higher so a clean fallback can still land. */
const LISTEN_MODEL_TIMEOUT_MS = 8_000;

const bodySchema = z.object({
  mode: z.enum(["reflect", "claim"]),
  message: z.string().max(4000).optional(),
  notes: z.array(z.string().max(500)).max(12).optional(),
  section: z.string().max(200).optional(),
});

type Ctx = { params: Promise<{ paperId: string }> };

const REFLECT_SYSTEM = `You are Pau, an upbeat, slightly sarcastic writing coach talking to a student. Coaching only: never write their paper or submission sentences.
The student is exploring an idea and has not locked anything. Reply in 1-2 short sentences (a third only if you need one light follow-up).
Rules:
- Acknowledge, then paraphrase their point in your own natural words. Never paste their wording, even after "that".
- Never quote their raw text, never use "I'm hearing", never truncate mid-sentence.
- Never leave a stray colon ("the idea that: maybe..."), and never keep lead-ins like "maybe", "hear me out", or "I think".
- If they said something like "maybe servant leaders just get less press", paraphrase it, e.g. "So your hunch is that servant leaders just don't get as much press."
- If they made a specific point, engage it and ask at most one light, specific follow-up.
- If they only asked to talk, keep the floor open. Do not ask "What's the one piece of this you want me to hold onto?"
Return JSON: {"reply": "..."}.`;

const CLAIM_SYSTEM = `You are Pau, a writing coach. Coaching only: never write the student's paper.
Given the ideas they explored while talking (not confirm phrases like "that's what I want for now"), write one clean sentence that summarizes their angle in your words, for their section note and the pressure test.
Rules:
- One grammatical sentence, no quotes, no mid-sentence cuts, no confirm/closing phrases.
- No join artifacts like ";" or "that:" or ";:".
- Strip lead-ins such as "maybe", "hear me out", and "I think". Do not leave them in the sentence.
- If they talked about the intro hinting that transformational leaders get more credit, and servant leaders getting less press, write: "Your intro hints that transformational leaders get more of the credit, while servant leaders get less press."
Return JSON: {"claim": "..."}.`;

const reflectSchema = {
  type: "object",
  additionalProperties: false,
  properties: { reply: { type: "string" } },
  required: ["reply"],
} as const;

const claimSchema = {
  type: "object",
  additionalProperties: false,
  properties: { claim: { type: "string" } },
  required: ["claim"],
} as const;

/**
 * Stage 2 listening: a short paraphrase or a synthesized claim.
 * Low-effort, short output; deterministic fallback if the model fails.
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
  const section = body.section ?? "";
  const fallbackReply = exploreReply(body.message ?? "", section);
  const fallbackClaim = listeningClaim([...(body.notes ?? []), body.message ?? ""], section);

  const demo = await getDemoSession();
  if (!demo && !hasSupabaseConfig()) {
    return NextResponse.json(body.mode === "claim" ? { claim: fallbackClaim } : { reply: fallbackReply });
  }
  const denied = demo ? Promise.resolve(null) : paperOwnerDenied(paperId);
  const call = demo || (await hasAuthCookie()) ? runModel(body, fallbackReply, fallbackClaim) : null;
  const deny = await denied;
  if (deny) return deny;
  const model = call ? await call : null;
  if (body.mode === "claim") return NextResponse.json({ claim: model ?? fallbackClaim, source: model ? "model" : "fallback" });
  return NextResponse.json({ reply: model ?? fallbackReply, source: model ? "model" : "fallback" });
}

async function runModel(
  body: z.infer<typeof bodySchema>,
  fallbackReply: string,
  fallbackClaim: string | null,
): Promise<string | null> {
  const user =
    body.mode === "claim"
      ? JSON.stringify({ section: body.section ?? "", notes: body.notes ?? [], last_message: body.message ?? "" })
      : JSON.stringify({ section: body.section ?? "", student_message: body.message ?? "" });
  const res = await grokChatJson({
    model: MODEL_FAST,
    system: body.mode === "claim" ? CLAIM_SYSTEM : REFLECT_SYSTEM,
    user,
    reasoningEffort: "low",
    jsonSchema: {
      name: body.mode === "claim" ? "listen_claim" : "listen_reply",
      schema: (body.mode === "claim" ? claimSchema : reflectSchema) as unknown as Record<string, unknown>,
    },
    timeoutMs: LISTEN_MODEL_TIMEOUT_MS,
  });
  if (!res.ok) return null;
  if (body.mode === "claim") return parseListenModelClaim(res.text, fallbackClaim);
  return parseListenModelReply(res.text, fallbackReply);
}
