import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaff, requireMember } from "@/lib/session";
import { blockedUserIds } from "@/lib/safety";
import { touchRoomPresence } from "@/lib/rooms";
import {
  allowedTiers,
  roomAllowed,
  WEB_ONLY_ERROR,
} from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

type Ctx = { params: Promise<{ roomId: string }> };

const MIN_SECONDS_BETWEEN_MESSAGES = 2;
const HISTORY_PAGE = 50;

const postSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

async function memberRoom(roomId: string, userId: string) {
  return prisma.roomMembership.findUnique({
    where: { roomId_userId: { roomId, userId } },
    include: {
      room: {
        select: {
          isActive: true,
          name: true,
          rules: true,
          pinnedNotice: true,
          slowModeSeconds: true,
        },
      },
    },
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
    return NextResponse.json(
      { error: "Join this room first." },
      { status: 403 },
    );
  }
  const tiers = await allowedTiers(user);
  if (!(await roomAllowed(roomId, tiers))) {
    return NextResponse.json({ error: WEB_ONLY_ERROR }, { status: 403 });
  }
  const filterText = textFilterFor(tiers);

  await touchRoomPresence(roomId, user.id, membership.lastSeenAt);

  const params = new URL(req.url).searchParams;
  const after = params.get("after");
  const afterDate = after ? new Date(after) : null;
  const before = params.get("before");
  const beforeDate = before && !after ? new Date(before) : null;
  const blocked = await blockedUserIds(user.id);

  const rows = await prisma.roomMessage.findMany({
    where: {
      roomId,
      deletedAt: null,
      senderId: { notIn: blocked },
      sender: { accountStatus: AccountStatus.ACTIVE },
      ...(afterDate && !Number.isNaN(afterDate.getTime())
        ? { createdAt: { gt: afterDate } }
        : beforeDate && !Number.isNaN(beforeDate.getTime())
          ? { createdAt: { lt: beforeDate } }
          : {}),
    },
    orderBy: { createdAt: afterDate ? "asc" : "desc" },
    take: afterDate ? 100 : HISTORY_PAGE + 1,
    include: {
      sender: {
        select: { id: true, profile: { select: { displayName: true } } },
      },
    },
  });
  const hasMore = !afterDate && rows.length > HISTORY_PAGE;
  if (hasMore) rows.pop();
  if (!afterDate) rows.reverse();

  const deletedIds = (
    await prisma.roomMessage.findMany({
      where: {
        roomId,
        deletedAt: { gte: new Date(Date.now() - 10 * 60_000) },
      },
      select: { id: true },
    })
  ).map((m) => m.id);

  const hostIds = afterDate
    ? []
    : (
        await prisma.roomMembership.findMany({
          where: { roomId, isHost: true },
          select: { userId: true },
        })
      ).map((h) => h.userId);

  return NextResponse.json({
    roomName: membership.room.name,
    room: {
      rules: membership.room.rules ? filterText(membership.room.rules) : null,
      pinnedNotice: membership.room.pinnedNotice
        ? filterText(membership.room.pinnedNotice)
        : null,
      slowModeSeconds: membership.room.slowModeSeconds,
      hostIds,
    },
    deletedIds,
    hasMore,
    youAreHost: membership.isHost || isStaff(user.role),
    mutedUntil:
      membership.mutedUntil && membership.mutedUntil > new Date()
        ? membership.mutedUntil
        : null,
    messages: rows.map((m) => ({
      id: m.id,
      body: filterText(m.body),
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
    return NextResponse.json(
      { error: "Join this room first." },
      { status: 403 },
    );
  }
  if (!(await roomAllowed(roomId, await allowedTiers(user)))) {
    return NextResponse.json({ error: WEB_ONLY_ERROR }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  if (membership.mutedUntil && membership.mutedUntil > new Date()) {
    return NextResponse.json(
      {
        error: `A host muted you in this room until ${membership.mutedUntil.toLocaleString()}.`,
      },
      { status: 403 },
    );
  }

  const host = membership.isHost || isStaff(user.role);
  const gapSeconds = host
    ? MIN_SECONDS_BETWEEN_MESSAGES
    : Math.max(MIN_SECONDS_BETWEEN_MESSAGES, membership.room.slowModeSeconds);
  const last = await prisma.roomMessage.findFirst({
    where: { roomId, senderId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < gapSeconds * 1000) {
    return NextResponse.json(
      {
        error:
          gapSeconds > MIN_SECONDS_BETWEEN_MESSAGES
            ? `Slow mode is on: one message every ${gapSeconds} seconds.`
            : "You're sending messages too quickly.",
      },
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
