import { AccountStatus, type PrismaClient } from "@prisma/client";
import { deleteObject } from "@/lib/storage";

/**
 * Removes stored files first, then the account; every row cascades from User.
 * Accounts under a legal hold (a child-safety or law-enforcement case) keep
 * the User row and its reports, which law requires us to preserve; the
 * profile, photos and selfies are still removed from the site.
 */
export async function deleteAccount(prisma: PrismaClient, userId: string) {
  const [photos, selfies, held] = await Promise.all([
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
  ]);

  await Promise.all([
    ...photos.flatMap((p) => [
      deleteObject(p.storageKey),
      deleteObject(p.thumbKey),
    ]),
    ...selfies.map((s) => deleteObject(s.storageKey)),
  ]);

  if (held > 0) {
    await prisma.$transaction([
      prisma.profile.deleteMany({ where: { userId } }),
      prisma.selfieVerification.deleteMany({ where: { userId } }),
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

  await prisma.user.delete({ where: { id: userId } });
}
