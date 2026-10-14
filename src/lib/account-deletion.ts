import type { PrismaClient } from "@prisma/client";
import { deleteObject } from "@/lib/storage";

/** Removes stored files first, then the account; every row cascades from User. */
export async function deleteAccount(prisma: PrismaClient, userId: string) {
  const [photos, selfies] = await Promise.all([
    prisma.photo.findMany({
      where: { profile: { userId } },
      select: { storageKey: true, thumbKey: true },
    }),
    prisma.selfieVerification.findMany({
      where: { userId },
      select: { storageKey: true },
    }),
  ]);

  await Promise.all([
    ...photos.flatMap((p) => [
      deleteObject(p.storageKey),
      deleteObject(p.thumbKey),
    ]),
    ...selfies.map((s) => deleteObject(s.storageKey)),
  ]);

  await prisma.user.delete({ where: { id: userId } });
}
