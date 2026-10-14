import { prisma } from "@/lib/prisma";
import { orderedPair } from "@/lib/utils";
import { endCallsBetween } from "@/lib/calls";
import { ReportPriority, ReportReason } from "@prisma/client";

/** Reports that alert staff immediately (see staffAlerts in jobs.ts). */
export const EMERGENCY_REASONS: ReportReason[] = [
  ReportReason.THREATS,
  ReportReason.UNDERAGE,
  ReportReason.EMERGENCY,
  ReportReason.NON_CONSENSUAL_CONTENT,
];

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new Error("Cannot block yourself");
  }

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
      create: { blockerId, blockedId },
      update: {},
    });

    // Remove likes both ways
    await tx.like.deleteMany({
      where: {
        OR: [
          { fromUserId: blockerId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: blockerId },
        ],
      },
    });

    // Soft-unmatch
    const [a, b] = orderedPair(blockerId, blockedId);
    await tx.match.updateMany({
      where: { userAId: a, userBId: b, unmatchedAt: null },
      data: { unmatchedAt: new Date() },
    });

    // Delete messages in that match
    const match = await tx.match.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    if (match) {
      await tx.message.deleteMany({ where: { matchId: match.id } });
    }

    await tx.messageRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: blockerId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: blockerId },
        ],
      },
    });

    await tx.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    });
  });
  await endCallsBetween(blockerId, blockedId);
}

/** Users hidden from viewer in either direction of a block. */
export async function blockedUserIds(viewerUserId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: viewerUserId }, { blockedId: viewerUserId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) =>
    b.blockerId === viewerUserId ? b.blockedId : b.blockerId,
  );
}

export async function isBlockedEitherWay(a: string, b: string) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

export function priorityForReason(reason: ReportReason): ReportPriority {
  if (EMERGENCY_REASONS.includes(reason) || reason === ReportReason.FRAUD) {
    return ReportPriority.HIGH;
  }
  return ReportPriority.NORMAL;
}
