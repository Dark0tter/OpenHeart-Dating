import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publish } from "@/lib/realtime";

/** "Typing…" ping. The browser sends at most one every few seconds. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  const user = await requireUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { matchId } = await ctx.params;
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      unmatchedAt: null,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    select: { userAId: true, userBId: true },
  });
  if (!match) return new NextResponse(null, { status: 404 });
  const otherId = match.userAId === user.id ? match.userBId : match.userAId;
  await publish(otherId, { type: "typing", matchId });
  return new NextResponse(null, { status: 204 });
}
