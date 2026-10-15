import { AccountStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/moderation/staff-actions";
import { roleRank } from "@/lib/roles";

export const ASSIGNABLE_ROLES = [
  UserRole.MEMBER,
  UserRole.MODERATOR,
  UserRole.ADMIN,
] as const;

export const ROLE_LABEL: Record<UserRole, string> = {
  MEMBER: "Member",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
  OWNER: "Owner",
};

/**
 * Promotes or demotes someone. Only the owner may do this, nobody can be
 * made owner here (use `npm run staff:set`), and new staff must be active,
 * age-verified members. Takes effect on their next page load.
 */
export async function setStaffRole(opts: {
  actor: { id: string; role: UserRole };
  userId: string;
  role: UserRole;
  reason: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const { actor, userId, role } = opts;
  const reason = opts.reason.trim();
  if (actor.role !== UserRole.OWNER) {
    return { ok: false, error: "Only the owner can change staff roles." };
  }
  if (!(ASSIGNABLE_ROLES as readonly UserRole[]).includes(role)) {
    return { ok: false, error: "That role can't be given from here." };
  }
  if (userId === actor.id) {
    return { ok: false, error: "You can't change your own role." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      accountStatus: true,
      verification: { select: { status: true } },
      profile: { select: { displayName: true } },
    },
  });
  if (!target) return { ok: false, error: "Member not found." };
  if (target.role === UserRole.OWNER) {
    return { ok: false, error: "The owner's role can't be changed here." };
  }
  if (target.role === role) {
    return { ok: false, error: `They're already ${ROLE_LABEL[role]}.` };
  }

  const promoting = roleRank(role) > roleRank(target.role);
  if (promoting) {
    if (target.accountStatus !== AccountStatus.ACTIVE) {
      return { ok: false, error: "Only active accounts can become staff." };
    }
    if (target.verification?.status !== "VERIFIED_ADULT") {
      return {
        ok: false,
        error:
          "Staff see sensitive reports, so they must verify their age first.",
      };
    }
  } else if (!reason) {
    return { ok: false, error: "Write a short reason for the demotion." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await logAction({
    actorId: actor.id,
    action: `role_${role.toLowerCase()}`,
    targetUserId: userId,
    note: `${ROLE_LABEL[target.role]} → ${ROLE_LABEL[role]}${reason ? `: ${reason}` : ""}`,
  });

  const name = target.profile?.displayName ?? "They";
  if (promoting) {
    await notify(userId, {
      type: "staff_alert",
      title: `You're now ${role === UserRole.ADMIN ? "an admin" : "a moderator"} on OpenHeart`,
      body: "Thank you for helping keep the community safe. Your tools are in Moderation.",
      link: "/mod",
      email: true,
    });
    return { ok: true, message: `${name} is now ${ROLE_LABEL[role]}.` };
  }
  await notify(userId, {
    type: "staff_alert",
    title:
      role === UserRole.MEMBER
        ? "Your OpenHeart staff access has ended"
        : "Your OpenHeart staff access has changed",
    link: role === UserRole.MEMBER ? "/feed" : "/mod",
    email: true,
  });
  return { ok: true, message: `${name} is now ${ROLE_LABEL[role]}.` };
}
