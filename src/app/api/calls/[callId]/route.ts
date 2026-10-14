import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publish } from "@/lib/realtime";
import { finishCall, iceServers, LIVE_STATUSES, RING_MS } from "@/lib/calls";

async function myCall(callId: string, userId: string) {
  return prisma.call.findFirst({
    where: { id: callId, OR: [{ callerId: userId }, { calleeId: userId }] },
  });
}

/** Call state plus any connection messages waiting for me (removed once read). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { callId } = await params;
  const call = await myCall(callId, user.id);
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = call.callerId === user.id ? "caller" : "callee";
  const otherId = role === "caller" ? call.calleeId : call.callerId;
  let status = call.status;
  if (status === "ringing" && Date.now() - call.createdAt.getTime() > RING_MS) {
    await finishCall(call.id, "missed");
    status = "missed";
  }

  const [other, signals] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: otherId },
      select: { displayName: true },
    }),
    LIVE_STATUSES.includes(status)
      ? prisma.callSignal.findMany({
          where: { callId, toUserId: user.id },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);
  if (signals.length) {
    await prisma.callSignal.deleteMany({
      where: { id: { in: signals.map((s) => s.id) } },
    });
  }

  return NextResponse.json({
    id: call.id,
    matchId: call.matchId,
    video: call.video,
    status,
    role,
    other: { userId: otherId, displayName: other?.displayName ?? "Your match" },
    signals: signals.map((s) => ({ kind: s.kind, data: s.data })),
    iceServers: iceServers(),
  });
}

const actionSchema = z.object({
  action: z.enum(["accept", "decline", "end"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { callId } = await params;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const call = await myCall(callId, user.id);
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isCallee = call.calleeId === user.id;
  const { action } = parsed.data;

  if (action === "accept") {
    if (!isCallee) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const updated = await prisma.call.updateMany({
      where: {
        id: callId,
        status: "ringing",
        createdAt: { gt: new Date(Date.now() - RING_MS) },
      },
      data: { status: "active", answeredAt: new Date() },
    });
    if (!updated.count) {
      return NextResponse.json(
        { error: "This call has ended." },
        { status: 409 },
      );
    }
    await publish(call.callerId, { type: "call", callId });
    return NextResponse.json({ ok: true });
  }

  if (action === "decline" && isCallee && call.status === "ringing") {
    await finishCall(callId, "declined");
  } else if (call.status === "ringing" && !isCallee) {
    await finishCall(callId, "missed");
  } else {
    await finishCall(callId, "ended");
  }
  return NextResponse.json({ ok: true });
}
