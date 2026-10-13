import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { roomOnlineMembers } from "@/lib/rooms";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId } = await ctx.params;
  const membership = await prisma.roomMembership.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Join this room first." }, { status: 403 });
  }

  return NextResponse.json({
    online: await roomOnlineMembers(roomId, user.id),
    youAreHidden: !user.showOnline,
  });
}
