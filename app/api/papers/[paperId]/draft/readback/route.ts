import { NextResponse } from "next/server";
import { z } from "zod";
import { hiddenSignalsFromIdeas } from "@/lib/drafting/hiddenSignals";
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
  const signals = FEATURES.hiddenDraft ? hiddenSignalsFromIdeas(body.ideas) : [];
  try {
    const shaped = shapeReadback({ ideas: body.ideas, signals });
    return NextResponse.json({
      ideas: shaped.ideas.map((idea) => ({
        id: idea.id,
        text: idea.text,
        sectionKey: idea.sectionKey,
      })),
      flags: shaped.flags.slice(0, 2).map((flag) => ({
        kind: flag.kind,
        text: flag.text,
        ideaId: flag.ideaId,
      })),
    });
  } catch {
    return NextResponse.json({ ideas: body.ideas, flags: [] });
  }
}
