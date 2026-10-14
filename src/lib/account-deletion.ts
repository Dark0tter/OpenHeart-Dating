import { AccountStatus, type PrismaClient } from "@prisma/client";
import { deleteObject } from "@/lib/storage";
import { deleteProviderData } from "@/lib/verification";

/**
 * Removes stored files first, then the account; every row cascades from User.
 * Accounts under a legal hold (a child-safety or law-enforcement case) keep
 * the User row, its reports and its messages, which law requires us to
 * preserve; everything else is removed now, and the rest is deleted by the
 * cleanup job once the hold is lifted (finishHeldDeletions).
 */
export async function deleteAccount(prisma: PrismaClient, userId: string) {
  const [photos, selfies, held, verification] = await Promise.all([
    prisma.photo.findMany({
      where: { profile: { userId } },
      select: { storageKey: true, thumbKey: true },
    }),
    prisma.selfieVerification.findMany({
      where: { userId },
      select: { storageKey: true },
    }),
    prisma.report.count({
      where: { reportedUserId: userId, legalHold: true },
    }),
    prisma.verification.findUnique({
      where: { userId },
      select: {
        provider: true,
        providerSessionId: true,
        providerDataDeletedAt: true,
      },
    }),
  ]);

  if (verification?.providerSessionId && !verification.providerDataDeletedAt) {
    await deleteProviderData(
      verification.provider,
      verification.providerSessionId,
    );
  }

  await Promise.all([
    ...photos.flatMap((p) => [
      deleteObject(p.storageKey),
      deleteObject(p.thumbKey),
    ]),
    ...selfies.map((s) => deleteObject(s.storageKey)),
  ]);

  // Bans outlive the account as anonymous hashes.
  await prisma.bannedIdentity.updateMany({
    where: { userId },
    data: { userId: null },
  });

  if (held > 0) {
    await prisma.$transaction([
      prisma.profile.deleteMany({ where: { userId } }),
      prisma.selfieVerification.deleteMany({ where: { userId } }),
      prisma.deviceToken.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.like.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      }),
      prisma.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { followingId: userId }] },
      }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.DELETED,
          statusChangedAt: new Date(),
          sessionVersion: { increment: 1 },
        },
      }),
    ]);
    return;
  }

  await prisma.supportTicket.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

/** Completes deletions that were paused by a legal hold that has since been lifted. */
export async function finishHeldDeletions(prisma: PrismaClient) {
  const waiting = await prisma.user.findMany({
    where: {
      accountStatus: AccountStatus.DELETED,
      reportsAgainst: { none: { legalHold: true } },
    },
    select: { id: true },
    take: 50,
  });
  for (const u of waiting) await deleteAccount(prisma, u.id);
  return waiting.length;
}
