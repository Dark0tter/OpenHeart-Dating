import { prisma } from "@/lib/prisma";
import { orderedPair } from "@/lib/utils";

/** Create a like; if reciprocal, create a match. Free — no paywall. */
export async function sendLike(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error("Cannot like yourself");
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: fromUserId, blockedId: toUserId },
        { blockerId: toUserId, blockedId: fromUserId },
      ],
    },
  });
  if (blocked) throw new Error("Cannot interact with this user");

  const like = await prisma.like.upsert({
    where: {
      fromUserId_toUserId: { fromUserId, toUserId },
    },
    create: { fromUserId, toUserId },
    update: {},
  });

  const reciprocal = await prisma.like.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId },
    },
  });

  let match = null;
  if (reciprocal) {
    const [userAId, userBId] = orderedPair(fromUserId, toUserId);
    match = await prisma.match.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: { unmatchedAt: null },
    });
  }

  return { like, match, isMatch: Boolean(match) };
}
