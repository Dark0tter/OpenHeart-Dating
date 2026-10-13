import { prisma } from "@/lib/prisma";
import { orderedPair } from "@/lib/utils";
import { ReportPriority, ReportReason } from "@prisma/client";

const EMERGENCY_REASONS: ReportReason[] = [
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
  });
}

export function priorityForReason(reason: ReportReason): ReportPriority {
  if (EMERGENCY_REASONS.includes(reason) || reason === ReportReason.FRAUD) {
    return ReportPriority.HIGH;
  }
  return ReportPriority.NORMAL;
}
