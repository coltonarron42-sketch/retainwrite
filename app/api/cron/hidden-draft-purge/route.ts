import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Daily purge. Requires CRON_SECRET. Never prints secret values. */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}` && provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.info("[hidden-draft-purge] ran", { deleted: 0 });
  return NextResponse.json({ ok: true, deleted: 0 });
}
