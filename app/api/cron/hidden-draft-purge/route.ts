import { NextResponse } from "next/server";
import { purgeHiddenDrafts } from "@/lib/server/readback";
import { purgeGhostShapes } from "@/lib/server/skeleton/ghost";

export const runtime = "nodejs";

/** Daily purge. Requires CRON_SECRET. Never prints secret values or draft text. */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("authorization");
  if (!expected || (provided !== `Bearer ${expected}` && provided !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deleted = await purgeHiddenDrafts();
  const ghostShapes = await purgeGhostShapes();
  console.info("[hidden-draft-purge] ran", { deleted, ghostShapes });
  return NextResponse.json({ ok: true, deleted, ghostShapes });
}
