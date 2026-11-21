import { NextResponse } from "next/server";
import { z } from "zod";
import { shapeReadback } from "@/lib/drafting/readback";
import { FEATURES } from "@/lib/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  ideas: z
    .array(z.object({ id: z.string(), text: z.string().max(600), sectionKey: z.string() }))
    .max(40),
});

type Ctx = { params: Promise<{ paperId: string }> };

/** Signals only. Hidden-draft prose never leaves the server. */
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
  if (!FEATURES.hiddenDraft) {
    return NextResponse.json({ ideas: body.ideas, flags: [] });
  }
  const shaped = shapeReadback({ ideas: body.ideas });
  return NextResponse.json({ ideas: shaped.ideas, flags: shaped.flags });
}
