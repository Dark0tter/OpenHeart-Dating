import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { blockedUserIds } from "@/lib/safety";
import { touchRoomPresence } from "@/lib/rooms";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

type Ctx = { params: Promise<{ roomId: string }> };

const MIN_SECONDS_BETWEEN_MESSAGES = 2;

const postSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

async function memberRoom(roomId: string, userId: string) {
  return prisma.roomMembership.findUnique({
    where: { roomId_userId: { roomId, userId } },
    include: { room: { select: { isActive: true, name: true } } },
  });
}

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId } = await ctx.params;
  const membership = await memberRoom(roomId, user.id);
  if (!membership?.room.isActive) {
    return NextResponse.json({ error: "Join this room first." }, { status: 403 });
  }

  await touchRoomPresence(roomId, user.id, membership.lastSeenAt);

  const after = new URL(req.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  const blocked = await blockedUserIds(user.id);

  const rows = await prisma.roomMessage.findMany({
    where: {
      roomId,
      deletedAt: null,
      senderId: { notIn: blocked },
      sender: { accountStatus: AccountStatus.ACTIVE },
      ...(afterDate && !Number.isNaN(afterDate.getTime())
        ? { createdAt: { gt: afterDate } }
        : {}),
    },
    orderBy: { createdAt: afterDate ? "asc" : "desc" },
    take: afterDate ? 100 : 50,
    include: {
      sender: {
        select: { id: true, profile: { select: { displayName: true } } },
      },
    },
  });
  if (!afterDate) rows.reverse();

  return NextResponse.json({
    roomName: membership.room.name,
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === user.id,
      sender: {
        id: m.sender.id,
        displayName: m.sender.profile?.displayName ?? "Member",
      },
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId } = await ctx.params;
  const membership = await memberRoom(roomId, user.id);
  if (!membership?.room.isActive) {
    return NextResponse.json({ error: "Join this room first." }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const last = await prisma.roomMessage.findFirst({
    where: { roomId, senderId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (
    last &&
    Date.now() - last.createdAt.getTime() < MIN_SECONDS_BETWEEN_MESSAGES * 1000
  ) {
    return NextResponse.json(
      { error: "You're sending messages too quickly." },
      { status: 429 },
    );
  }

  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: `room:${roomId}`,
    fields: { body: parsed.data.body },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  const message = await prisma.roomMessage.create({
    data: { roomId, senderId: user.id, body: parsed.data.body },
  });
  return NextResponse.json({ id: message.id, createdAt: message.createdAt });
}
