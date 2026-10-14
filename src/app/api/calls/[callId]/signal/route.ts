import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publish } from "@/lib/realtime";
import { LIVE_STATUSES, MAX_SIGNALS_PER_CALL } from "@/lib/calls";

const schema = z.object({
  kind: z.enum(["offer", "answer", "ice"]),
  data: z.string().min(1).max(20_000),
});

/** Passes connection setup (WebRTC offer/answer/ICE) to the other device. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { callId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signal" }, { status: 400 });
  }
  const call = await prisma.call.findFirst({
    where: {
      id: callId,
      status: { in: LIVE_STATUSES },
      OR: [{ callerId: user.id }, { calleeId: user.id }],
    },
    include: { _count: { select: { signals: true } } },
  });
  if (!call) {
    return NextResponse.json(
      { error: "This call has ended." },
      { status: 409 },
    );
  }
  const isCaller = call.callerId === user.id;
  const { kind, data } = parsed.data;
  if ((kind === "offer" && !isCaller) || (kind === "answer" && isCaller)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (call._count.signals >= MAX_SIGNALS_PER_CALL) {
    return NextResponse.json({ error: "Too many signals" }, { status: 429 });
  }

  const toUserId = isCaller ? call.calleeId : call.callerId;
  await prisma.callSignal.create({
    data: { callId, toUserId, kind, data },
  });
  await publish(toUserId, { type: "call", callId });
  return NextResponse.json({ ok: true });
}
