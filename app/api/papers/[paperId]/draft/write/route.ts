import { NextResponse } from "next/server";
import { z } from "zod";
import { assertWriteInOrder } from "@/lib/drafting/order";

export const runtime = "nodejs";

const bodySchema = z.object({
  paragraphs: z
    .array(
      z.object({
        key: z.string(),
        sectionKey: z.string(),
        status: z.enum(["locked", "open", "saved", "needs_review"]),
      }),
    )
    .max(24),
  targetKey: z.string(),
  text: z.string().max(20_000),
});

type Ctx = { params: Promise<{ paperId: string }> };

/** Server-side strict order. A later section cannot be saved early. */
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
  const gate = assertWriteInOrder(body.paragraphs, body.targetKey);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true, words: body.text.trim().split(/\s+/).filter(Boolean).length });
}
