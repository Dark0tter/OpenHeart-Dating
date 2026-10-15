import { AccountStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/moderation/staff-actions";
import { roleRank } from "@/lib/roles";
import { disableTwoStep } from "@/lib/two-step";

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
      body: "Thank you for helping keep the community safe. Your tools are in Moderation; you'll be asked to turn on two-step sign-in first.",
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

/**
 * For a staff member who lost their phone and recovery codes: turns off
 * two-step and signs them out, so they set it up again on next sign-in.
 */
export async function resetStaffTwoStep(opts: {
  actor: { id: string; role: UserRole };
  userId: string;
  reason: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const reason = opts.reason.trim();
  if (opts.actor.role !== UserRole.OWNER) {
    return { ok: false, error: "Only the owner can reset two-step sign-in." };
  }
  if (opts.userId === opts.actor.id) {
    return { ok: false, error: "Reset your own with npm run two-step:reset." };
  }
  if (!reason)
    return { ok: false, error: "Write a short reason for the reset." };
  const target = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: {
      role: true,
      totpEnabledAt: true,
      profile: { select: { displayName: true } },
    },
  });
  if (
    !target ||
    target.role === UserRole.MEMBER ||
    target.role === UserRole.OWNER
  ) {
    return {
      ok: false,
      error: "Only moderators and admins can be reset here.",
    };
  }
  if (!target.totpEnabledAt) {
    return { ok: false, error: "They haven't set up two-step sign-in yet." };
  }
  await disableTwoStep(opts.userId);
  await logAction({
    actorId: opts.actor.id,
    action: "two_step_reset",
    targetUserId: opts.userId,
    note: reason,
  });
  const name = target.profile?.displayName ?? "They";
  return {
    ok: true,
    message: `${name} will set up two-step sign-in again next time they sign in.`,
  };
}
