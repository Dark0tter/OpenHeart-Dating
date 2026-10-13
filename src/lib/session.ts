import { AccountStatus, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export function isStaff(role: UserRole | undefined | null): boolean {
  return role === UserRole.MODERATOR || role === UserRole.ADMIN;
}

/** Moderators and admins. Pass "ADMIN" for admin-only actions. */
export async function requireStaff(
  minimum: "MODERATOR" | "ADMIN" = "MODERATOR",
) {
  const user = await requireUser();
  if (!user) return null;
  if (
    minimum === "ADMIN" ? user.role !== UserRole.ADMIN : !isStaff(user.role)
  ) {
    return null;
  }
  return user;
}
