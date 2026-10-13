import { NextResponse } from "next/server";
import { RoomInviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { interestRoomIds } from "@/lib/rooms";

export async function GET() {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate your profile to join rooms." },
      { status: 403 },
    );
  }

  const [rooms, memberships, invites, matching] = await Promise.all([
    prisma.chatRoom.findMany({
      where: { isActive: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: { _count: { select: { members: true } } },
    }),
    prisma.roomMembership.findMany({
      where: { userId: user.id },
      select: { roomId: true },
    }),
    prisma.roomInvite.findMany({
      where: { userId: user.id, status: RoomInviteStatus.PENDING },
      select: { roomId: true },
    }),
    interestRoomIds(user.id),
  ]);

  const joined = new Set(memberships.map((m) => m.roomId));
  const invited = new Set(invites.map((i) => i.roomId));

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      kind: r.kind,
      memberCount: r._count.members,
      joined: joined.has(r.id),
      invited: invited.has(r.id) && !joined.has(r.id),
      matchesProfile: matching.has(r.id),
    })),
  });
}
