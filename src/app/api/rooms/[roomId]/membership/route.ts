import { NextResponse } from "next/server";
import { RoomInviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";

type Ctx = { params: Promise<{ roomId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate your profile to join rooms." },
      { status: 403 },
    );
  }
  const { roomId } = await ctx.params;
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isActive: true },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.roomMembership.upsert({
      where: { roomId_userId: { roomId, userId: user.id } },
      create: { roomId, userId: user.id },
      update: {},
    }),
    prisma.roomInvite.updateMany({
      where: { roomId, userId: user.id, status: RoomInviteStatus.PENDING },
      data: { status: RoomInviteStatus.ACCEPTED, respondedAt: new Date() },
    }),
  ]);
  return NextResponse.json({ joined: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId } = await ctx.params;
  await prisma.roomMembership.deleteMany({
    where: { roomId, userId: user.id },
  });
  return NextResponse.json({ joined: false });
}
