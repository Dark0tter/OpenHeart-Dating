import type { UserRole } from "@prisma/client";

const RANK: Record<UserRole, number> = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleRank(role: UserRole | undefined | null): number {
  return role ? RANK[role] : 0;
}

export function isStaff(role: UserRole | undefined | null): boolean {
  return roleRank(role) >= RANK.MODERATOR;
}

/** Admins and the owner. */
export function isAdmin(role: UserRole | undefined | null): boolean {
  return roleRank(role) >= RANK.ADMIN;
}

/** Staff can only act on people ranked below them (the owner on everyone else). */
export function outranks(
  actor: UserRole | undefined | null,
  target: UserRole | undefined | null,
): boolean {
  return roleRank(actor) > roleRank(target);
}
