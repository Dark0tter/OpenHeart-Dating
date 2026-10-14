import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Manual or external trigger for timed jobs: `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (
    !secret ||
    given.length !== secret.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await runJobs());
}
