import { NextResponse } from "next/server";
import { RoomInviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** Declining is remembered so the same invite isn't sent again. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId } = await ctx.params;
  await prisma.roomInvite.updateMany({
    where: { roomId, userId: user.id, status: RoomInviteStatus.PENDING },
    data: { status: RoomInviteStatus.DECLINED, respondedAt: new Date() },
  });
  return NextResponse.json({ declined: true });
}
