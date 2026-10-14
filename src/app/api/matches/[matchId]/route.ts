import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publish } from "@/lib/realtime";
import { endCallsBetween } from "@/lib/calls";

/**
 * Unmatch: the conversation disappears for both people and they won't be
 * re-matched by old likes. Messages are kept 30 days (for reports), then deleted.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { matchId } = await ctx.params;
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      unmatchedAt: null,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const otherId = match.userAId === user.id ? match.userBId : match.userAId;
  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { unmatchedAt: new Date() },
    }),
    prisma.like.deleteMany({
      where: {
        OR: [
          { fromUserId: user.id, toUserId: otherId },
          { fromUserId: otherId, toUserId: user.id },
        ],
      },
    }),
    prisma.notification.deleteMany({
      where: {
        userId: { in: [user.id, otherId] },
        link: `/messages/${matchId}`,
      },
    }),
  ]);
  await endCallsBetween(user.id, otherId);
  await publish(otherId, { type: "message", matchId });
  return NextResponse.json({ ok: true });
}
