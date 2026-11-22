import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which Vercel region served this function (checks vercel.json "regions"). No user data. */
export function GET() {
  return NextResponse.json(
    { ok: true, region: process.env.VERCEL_REGION ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
