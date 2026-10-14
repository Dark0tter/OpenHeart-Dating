import { NextResponse } from "next/server";
import { personaDecision, personaSignatureValid } from "@/lib/persona";
import { finishVerification } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBody = await req.text();
  if (
    !personaSignatureValid(
      req.headers.get("persona-signature"),
      rawBody,
      secret,
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const decision = personaDecision(event);
  if (!decision) return NextResponse.json({ ok: true, ignored: "not final" });

  const result = await finishVerification("persona", decision);
  if (!result)
    return NextResponse.json({ ok: true, ignored: "unknown reference" });
  return NextResponse.json({ ok: true });
}
