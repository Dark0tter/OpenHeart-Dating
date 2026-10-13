import { AccountStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      verification: true,
    },
  });
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) return null;
  return user;
}
