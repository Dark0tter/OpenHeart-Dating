import { NextResponse } from "next/server";
import { diditDecision, diditSignatureValid } from "@/lib/didit";
import { finishVerification } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBody = await req.text();
  const valid = diditSignatureValid(
    {
      signatureV2: req.headers.get("x-signature-v2"),
      signature: req.headers.get("x-signature"),
      timestamp: req.headers.get("x-timestamp"),
    },
    rawBody,
    secret,
  );
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const decision = diditDecision(event);
  if (!decision) return NextResponse.json({ ok: true, ignored: "not final" });

  const result = await finishVerification("didit", decision);
  if (!result)
    return NextResponse.json({ ok: true, ignored: "unknown reference" });
  return NextResponse.json({ ok: true });
}
