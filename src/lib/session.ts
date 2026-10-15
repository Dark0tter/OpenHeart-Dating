import { AccountStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleRank } from "@/lib/roles";

export { isAdmin, isStaff, outranks, roleRank } from "@/lib/roles";

/** How stale lastActiveAt may get before a request refreshes it. */
const ACTIVE_TOUCH_MS = 5 * 60 * 1000;

/**
 * The signed-in user whatever their account status, or null. Sessions issued
 * before the last password change or "sign out everywhere" are rejected.
 */
export async function currentAccount() {
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
  if (!user || user.accountStatus === AccountStatus.DELETED) return null;
  if ((session.sv ?? 0) !== user.sessionVersion) return null;
  if (
    user.accountStatus === AccountStatus.SUSPENDED &&
    user.suspendedUntil &&
    user.suspendedUntil <= new Date()
  ) {
    const lifted = await prisma.user.update({
      where: { id: user.id },
      data: {
        accountStatus: AccountStatus.ACTIVE,
        statusReason: null,
        statusChangedAt: new Date(),
        suspendedUntil: null,
      },
      include: { profile: true, verification: true },
    });
    await prisma.modAction.create({
      data: {
        actorId: null,
        action: "suspension_expired",
        targetUserId: user.id,
      },
    });
    return lifted;
  }
  if (Date.now() - user.lastActiveAt.getTime() > ACTIVE_TOUCH_MS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
  }
  return user;
}

export async function requireUser() {
  const user = await currentAccount();
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) return null;
  return user;
}

/** Rooms, posts, and private requests are for verified adults with an active profile. */
export async function requireMember() {
  const user = await requireUser();
  if (!user?.profile?.isActive) return null;
  if (user.verification?.status !== "VERIFIED_ADULT") return null;
  return { ...user, profile: user.profile };
}

/** Staff at or above `minimum`. The owner passes every check. */
export async function requireStaff(
  minimum: "MODERATOR" | "ADMIN" | "OWNER" = "MODERATOR",
) {
  const user = await requireUser();
  if (!user) return null;
  if (roleRank(user.role) < roleRank(minimum)) return null;
  return user;
}
