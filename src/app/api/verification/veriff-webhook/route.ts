import { NextResponse } from "next/server";
import { veriffDecision, veriffSignatureValid } from "@/lib/veriff";
import { finishVerification } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.VERIFF_SHARED_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBody = await req.text();
  if (
    !veriffSignatureValid(req.headers.get("x-hmac-signature"), rawBody, secret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const decision = veriffDecision(event);
  if (!decision) return NextResponse.json({ ok: true, ignored: "not final" });

  const result = await finishVerification("veriff", decision);
  if (!result)
    return NextResponse.json({ ok: true, ignored: "unknown reference" });
  return NextResponse.json({ ok: true });
}
