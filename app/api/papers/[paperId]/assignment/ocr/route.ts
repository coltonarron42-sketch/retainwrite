import { NextResponse } from "next/server";
import { z } from "zod";
import { transcribePage } from "@/lib/assignment/ocr";
import { hasGrokKey } from "@/lib/ai/grok";
import { getDemoSession } from "@/lib/demo/session-server";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Downscaled JPEG/PNG data URLs from the browser (photos or scanned PDF pages). */
const bodySchema = z.object({
  images: z
    .array(
      z
        .string()
        .max(1_000_000)
        .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/),
    )
    .min(1)
    .max(4),
});

type Ctx = { params: Promise<{ paperId: string }> };

/**
 * Read text from assignment photos or scanned pages with vision OCR.
 * // SOP: coaching only, never generate submission text (transcription only)
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
    return NextResponse.json(
      { error: "That image is too large or not a JPG/PNG. Try a smaller photo." },
      { status: 400 },
    );
  }

  const demo = await getDemoSession();
  if (!demo) {
    if (!hasSupabaseConfig()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: paper } = await supabase
      .from("papers")
      .select("id")
      .eq("id", paperId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  if (!hasGrokKey()) {
    console.error("[ocr] no vision key configured");
    return NextResponse.json(
      { error: "Photo reading isn't available right now. Paste the assignment text instead." },
      { status: 503 },
    );
  }

  const started = Date.now();
  const pages = await Promise.all(
    body.images.map((imageUrl, i) => transcribePage({ imageUrl, page: i + 1 })),
  );
  const texts = pages.map((page) => page.text.trim());
  const text = texts.filter(Boolean).join("\n\n");
  console.info("[ocr] request finished", {
    ms: Date.now() - started,
    pages: pages.length,
    readPages: texts.filter(Boolean).length,
    demo: Boolean(demo),
  });
  if (!text) {
    return NextResponse.json(
      {
        error:
          "We couldn't read any text in this image. Retake it in brighter light with the whole page in view, or paste the text.",
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ text, pages: texts });
}
