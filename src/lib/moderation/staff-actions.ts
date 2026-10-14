import { AccountStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/request";
import { deleteObject, getObject, putObject } from "@/lib/storage";

/**
 * Every staff action goes through here so it lands in the audit log. Actions
 * that affect a member tell them by email (when email is configured).
 */

export async function logAction(entry: {
  actorId: string | null;
  action: string;
  targetUserId?: string | null;
  reportId?: string | null;
  note?: string | null;
}) {
  await prisma.modAction.create({ data: entry });
}

async function emailMember(
  userId: string,
  subject: string,
  paragraphs: string[],
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (user) await sendEmail({ to: user.email, subject, paragraphs });
}

export async function suspendUser(opts: {
  actorId: string;
  userId: string;
  reason: string;
  days: number | null;
  reportId?: string;
}) {
  const until = opts.days
    ? new Date(Date.now() + opts.days * 24 * 60 * 60 * 1000)
    : null;
  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      accountStatus: AccountStatus.SUSPENDED,
      statusReason: opts.reason,
      statusChangedAt: new Date(),
      suspendedUntil: until,
    },
  });
  await logAction({
    actorId: opts.actorId,
    action: opts.days ? `suspend_${opts.days}d` : "suspend_indefinite",
    targetUserId: opts.userId,
    reportId: opts.reportId,
    note: opts.reason,
  });
  await emailMember(opts.userId, "Your OpenHeart account has been suspended", [
    `Your account was suspended ${until ? `until ${until.toUTCString()}` : "until our team reviews it"}.`,
    `Reason: ${opts.reason}`,
    `If you think this is a mistake, sign in at ${appUrl()}/login to send an appeal. A different moderator will review it.`,
  ]);
}

export async function reinstateUser(opts: {
  actorId: string | null;
  userId: string;
  note?: string;
}) {
  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      accountStatus: AccountStatus.ACTIVE,
      statusReason: null,
      statusChangedAt: new Date(),
      suspendedUntil: null,
    },
  });
  await logAction({
    actorId: opts.actorId,
    action: "reinstate",
    targetUserId: opts.userId,
    note: opts.note,
  });
}

export async function warnUser(opts: {
  actorId: string;
  userId: string;
  message: string;
  reportId?: string;
}) {
  await logAction({
    actorId: opts.actorId,
    action: "warn",
    targetUserId: opts.userId,
    reportId: opts.reportId,
    note: opts.message,
  });
  await emailMember(opts.userId, "A note from the OpenHeart safety team", [
    opts.message,
    "Repeated issues can lead to suspension. Our community guidelines are at " +
      `${appUrl()}/guidelines.`,
  ]);
}

export async function closeReport(opts: {
  actorId: string;
  reportId: string;
  status: "resolved" | "dismissed";
  resolution: string;
}) {
  const report = await prisma.report.update({
    where: { id: opts.reportId },
    data: {
      status: opts.status,
      resolution: opts.resolution,
      resolvedAt: new Date(),
      resolvedById: opts.actorId,
    },
  });
  await logAction({
    actorId: opts.actorId,
    action: `report_${opts.status}`,
    targetUserId: report.reportedUserId,
    reportId: report.id,
    note: opts.resolution,
  });
}

/**
 * Child-safety escalation: suspends the account, places a legal hold, and
 * copies the account's photos and messages into evidence storage so they
 * survive deletion. Filing the CyberTipline report itself is done by a
 * person at report.cybertip.org; record its number with recordExternalRef.
 */
export async function escalateChildSafety(opts: {
  actorId: string;
  reportId: string;
  note: string;
}) {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: opts.reportId },
  });
  const userId = report.reportedUserId;

  const [user, photos, messages] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        dateOfBirth: true,
        createdAt: true,
        lastActiveAt: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            city: true,
            state: true,
            country: true,
          },
        },
      },
    }),
    prisma.photo.findMany({
      where: { profile: { userId } },
      select: {
        id: true,
        storageKey: true,
        contentHash: true,
        createdAt: true,
      },
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { id: true, matchId: true, body: true, createdAt: true },
    }),
  ]);

  const prefix = `evidence/${report.id}`;
  for (const p of photos) {
    const data = p.storageKey ? await getObject(p.storageKey) : null;
    if (data)
      await putObject(`${prefix}/photo-${p.id}.webp`, data, "image/webp");
  }
  await putObject(
    `${prefix}/account.json`,
    Buffer.from(
      JSON.stringify(
        {
          preservedAt: new Date().toISOString(),
          report,
          user,
          photos,
          messages,
        },
        null,
        2,
      ),
    ),
    "application/json",
  );

  await prisma.report.update({
    where: { id: report.id },
    data: {
      legalHold: true,
      escalatedAt: new Date(),
      priority: "HIGH",
      evidenceKey: report.evidenceKey ?? `${prefix}/account.json`,
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: AccountStatus.SUSPENDED,
      statusReason: "Under review by our safety team.",
      statusChangedAt: new Date(),
      suspendedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });
  await logAction({
    actorId: opts.actorId,
    action: "escalate_child_safety",
    targetUserId: userId,
    reportId: report.id,
    note: opts.note,
  });
}

export async function recordExternalRef(opts: {
  actorId: string;
  reportId: string;
  externalRef: string;
}) {
  const report = await prisma.report.update({
    where: { id: opts.reportId },
    data: { externalRef: opts.externalRef },
  });
  await logAction({
    actorId: opts.actorId,
    action: "record_cybertip_number",
    targetUserId: report.reportedUserId,
    reportId: report.id,
    note: opts.externalRef,
  });
}

export async function setLegalHold(opts: {
  actorId: string;
  reportId: string;
  hold: boolean;
}) {
  const report = await prisma.report.update({
    where: { id: opts.reportId },
    data: { legalHold: opts.hold },
  });
  await logAction({
    actorId: opts.actorId,
    action: opts.hold ? "legal_hold_on" : "legal_hold_off",
    targetUserId: report.reportedUserId,
    reportId: report.id,
  });
}

export async function reviewPhoto(opts: {
  actorId: string;
  photoId: string;
  approve: boolean;
  reason?: string;
  blockForever?: boolean;
}) {
  const photo = await prisma.photo.findUniqueOrThrow({
    where: { id: opts.photoId },
    include: { profile: { select: { userId: true } } },
  });
  if (opts.approve) {
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        status: ReviewStatus.APPROVED,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
  } else {
    if (opts.blockForever && photo.contentHash) {
      await prisma.blockedImageHash.upsert({
        where: { hash: photo.contentHash },
        create: {
          hash: photo.contentHash,
          reason: opts.reason ?? "Removed by moderator",
        },
        update: {},
      });
    }
    await Promise.all([
      deleteObject(photo.storageKey),
      deleteObject(photo.thumbKey),
    ]);
    await prisma.photo.delete({ where: { id: photo.id } });
    await emailMember(
      photo.profile.userId,
      "A photo was removed from your profile",
      [
        `One of your photos was removed because it doesn't meet our photo rules${opts.reason ? `: ${opts.reason}` : "."}`,
        `Photo rules are in our community guidelines at ${appUrl()}/guidelines.`,
      ],
    );
  }
  await logAction({
    actorId: opts.actorId,
    action: opts.approve
      ? "photo_approve"
      : opts.blockForever
        ? "photo_remove_block"
        : "photo_remove",
    targetUserId: photo.profile.userId,
    note: opts.reason,
  });
}

/** The selfie file is deleted as soon as it's reviewed either way. */
export async function reviewSelfie(opts: {
  actorId: string;
  selfieId: string;
  approve: boolean;
  note?: string;
}) {
  const selfie = await prisma.selfieVerification.findUniqueOrThrow({
    where: { id: opts.selfieId },
  });
  await deleteObject(selfie.storageKey);
  await prisma.selfieVerification.update({
    where: { id: selfie.id },
    data: {
      status: opts.approve ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
      reviewerId: opts.actorId,
      reviewNote: opts.note,
      reviewedAt: new Date(),
      storageKey: null,
    },
  });
  if (opts.approve) {
    await prisma.user.update({
      where: { id: selfie.userId },
      data: { photoVerifiedAt: new Date() },
    });
  }
  await logAction({
    actorId: opts.actorId,
    action: opts.approve ? "selfie_approve" : "selfie_reject",
    targetUserId: selfie.userId,
    note: opts.note,
  });
}

export async function reviewAppeal(opts: {
  actorId: string;
  appealId: string;
  approve: boolean;
  note: string;
}) {
  const appeal = await prisma.appeal.update({
    where: { id: opts.appealId },
    data: {
      status: opts.approve ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
      reviewerId: opts.actorId,
      reviewNote: opts.note,
      reviewedAt: new Date(),
    },
  });
  if (opts.approve) {
    await reinstateUser({
      actorId: opts.actorId,
      userId: appeal.userId,
      note: "Appeal approved",
    });
  }
  await logAction({
    actorId: opts.actorId,
    action: opts.approve ? "appeal_approve" : "appeal_reject",
    targetUserId: appeal.userId,
    note: opts.note,
  });
  await emailMember(
    appeal.userId,
    opts.approve ? "Your appeal was approved" : "Your appeal was reviewed",
    opts.approve
      ? ["Your OpenHeart account has been restored. Welcome back.", opts.note]
      : [
          "We reviewed your appeal and the suspension stays in place.",
          opts.note,
        ],
  );
}

export async function closeTicket(opts: {
  actorId: string;
  ticketId: string;
  reply: string;
}) {
  const ticket = await prisma.supportTicket.update({
    where: { id: opts.ticketId },
    data: { status: "closed", staffNote: opts.reply, closedAt: new Date() },
  });
  await logAction({
    actorId: opts.actorId,
    action: "ticket_close",
    targetUserId: ticket.userId,
    note: opts.reply,
  });
  if (opts.reply.trim()) {
    await sendEmail({
      to: ticket.email,
      subject: `Re: ${ticket.subject}`,
      paragraphs: [opts.reply, "— OpenHeart support"],
    });
  }
}
