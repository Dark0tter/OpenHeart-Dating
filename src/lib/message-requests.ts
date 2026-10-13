import { MessageRequestStatus, Prisma } from "@prisma/client";
import { orderedPair } from "@/lib/utils";

/** Accepting is the second half of mutual consent: it opens (or reopens) the private conversation. */
export async function acceptRequestTx(
  tx: Prisma.TransactionClient,
  request: { id: string; fromUserId: string; toUserId: string; body: string },
) {
  await tx.messageRequest.update({
    where: { id: request.id },
    data: { status: MessageRequestStatus.ACCEPTED, resolvedAt: new Date() },
  });
  const [userAId, userBId] = orderedPair(request.fromUserId, request.toUserId);
  const match = await tx.match.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: { unmatchedAt: null },
  });
  await tx.message.create({
    data: {
      matchId: match.id,
      senderId: request.fromUserId,
      body: request.body,
    },
  });
  return match;
}
