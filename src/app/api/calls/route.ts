import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { publish } from "@/lib/realtime";
import { pushOnly } from "@/lib/notify";
import { busy, canCall, iceServers, RING_MS } from "@/lib/calls";

const schema = z.object({ matchId: z.string().uuid(), video: z.boolean() });

/** Calls ringing for me or in progress — used when the app opens from a notification. */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const calls = await prisma.call.findMany({
    where: {
      calleeId: user.id,
      status: "ringing",
      createdAt: { gt: new Date(Date.now() - RING_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  return NextResponse.json({
    ringing: calls.map((c) => c.id),
    iceServers: iceServers(),
  });
}

/** Starts ringing the other person. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid call" }, { status: 400 });
  }
  const { matchId, video } = parsed.data;

  const check = await canCall(user.id, matchId);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const limit = await limitFor("callsPerUser", user.id);
  if (!limit.ok)
    return tooManyRequests(limit, "Too many calls. Try again later.");
  if (await busy([user.id, check.otherId])) {
    return NextResponse.json(
      { error: "One of you is already on a call." },
      { status: 409 },
    );
  }

  const call = await prisma.call.create({
    data: { matchId, callerId: user.id, calleeId: check.otherId, video },
  });
  await publish(check.otherId, { type: "call", callId: call.id });
  await pushOnly(check.otherId, {
    title: video ? "Incoming video call" : "Incoming call",
    body: "Someone you matched with is calling you on OpenHeart.",
    link: `/messages/${matchId}`,
  });
  return NextResponse.json({ callId: call.id, iceServers: iceServers() });
}
