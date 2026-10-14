import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { dailyDigest, staffAlerts } from "@/lib/staff-alerts";
import { expireCalls } from "@/lib/calls";
import { deleteAccount, finishHeldDeletions } from "@/lib/account-deletion";

/**
 * Timed work: date check-in reminders and alerts, event reminders, and data
 * clean-up. Runs every minute inside the web server (see instrumentation.ts);
 * a Postgres advisory lock makes sure only one server instance does it.
 * Can also be triggered from outside via /api/cron with CRON_SECRET.
 */

const LOCK_ID = 727_001;
export const CHECKIN_GRACE_MS = 15 * 60 * 1000;
const CHECKIN_RETRY_MS = 5 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** The lock lives as long as this transaction, so it's always released. */
export async function runJobs(now = new Date()) {
  return prisma.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${LOCK_ID}) AS locked`;
      if (!locked) return { skipped: true };
      return {
        staffAlerts: await staffAlerts(now),
        dailyDigest: await dailyDigest(now),
        checkIns: await checkIns(now),
        eventReminders: await eventReminders(now),
        calls: await expireCalls(now),
        cleanup: await cleanup(now),
      };
    },
    { timeout: 5 * 60 * 1000, maxWait: 10_000 },
  );
}

async function checkIns(now: Date) {
  const due = await prisma.safetyCheckIn.findMany({
    where: { status: "active", checkInBy: { lte: now }, remindedAt: null },
    take: 200,
  });
  for (const c of due) {
    await notify(c.userId, {
      type: "event",
      title: "Time to check in — are you OK?",
      body: `Tap "I'm safe" within 15 minutes or we'll email ${c.contactName}.`,
      link: "/safety/check-in",
    });
    await prisma.safetyCheckIn.update({
      where: { id: c.id },
      data: { remindedAt: now },
    });
  }

  const overdue = await prisma.safetyCheckIn.findMany({
    where: {
      status: "active",
      checkInBy: { lte: new Date(now.getTime() - CHECKIN_GRACE_MS) },
      OR: [
        { alertFailedAt: null },
        { alertFailedAt: { lte: new Date(now.getTime() - CHECKIN_RETRY_MS) } },
      ],
    },
    include: {
      user: { select: { profile: { select: { displayName: true } } } },
    },
    take: 200,
  });
  let alerted = 0;
  let failed = 0;
  for (const c of overdue) {
    const name = c.user.profile?.displayName ?? "Your friend";
    const sent = await sendEmail({
      to: c.contactEmail,
      subject: `${name} hasn't checked in after their date`,
      paragraphs: [
        `Hi ${c.contactName}, ${name} asked OpenHeart to let you know if they didn't check in after meeting someone. They planned to check in by ${c.checkInBy.toUTCString()} and haven't yet.`,
        `Who they were meeting: ${c.meetingWith}`,
        `Where: ${c.place}`,
        `When: ${c.startsAt.toUTCString()}`,
        ...(c.note ? [`Their note: ${c.note}`] : []),
        "Please try to reach them. If you believe they're in danger, contact local emergency services.",
      ],
    });
    if (sent) {
      alerted++;
      await prisma.safetyCheckIn.update({
        where: { id: c.id },
        data: { status: "alerted", alertedAt: now, alertFailedAt: null },
      });
      continue;
    }
    // Keep retrying, and make sure the member knows nobody was told yet.
    failed++;
    if (!c.alertFailedAt) {
      await notify(c.userId, {
        type: "event",
        title: `We couldn't reach ${c.contactName}`,
        body: "Our email to your safety contact failed; we'll keep trying. If you need help, call them or local emergency services.",
        link: "/safety/check-in",
      });
    }
    await prisma.safetyCheckIn.update({
      where: { id: c.id },
      data: { alertFailedAt: now },
    });
  }
  return { reminded: due.length, alerted, failed };
}

async function eventReminders(now: Date) {
  const events = await prisma.event.findMany({
    where: {
      cancelledAt: null,
      remindedAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + DAY) },
    },
    include: {
      rsvps: { where: { status: "going" }, select: { userId: true } },
    },
    take: 100,
  });
  for (const e of events) {
    for (const r of e.rsvps) {
      await notify(r.userId, {
        type: "event",
        title: `Coming up: ${e.title}`,
        body: "An event you're going to starts within 24 hours.",
        link: `/events/${e.id}`,
      });
    }
    await prisma.event.update({
      where: { id: e.id },
      data: { remindedAt: now },
    });
  }
  return { events: events.length };
}

async function cleanup(now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [checkIns, notifications, buckets, tokens] = await Promise.all([
    prisma.safetyCheckIn.deleteMany({
      where: {
        OR: [
          { status: { in: ["safe", "cancelled"] }, endedAt: { lt: weekAgo } },
          { status: "alerted", alertedAt: { lt: weekAgo } },
        ],
      },
    }),
    prisma.notification.deleteMany({
      where: { readAt: { lt: new Date(now.getTime() - 90 * DAY) } },
    }),
    prisma.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: new Date(now.getTime() - 2 * DAY) } },
    }),
    prisma.authToken.deleteMany({ where: { expiresAt: { lt: weekAgo } } }),
  ]);

  // A check-in whose alert never got through stops retrying after two days.
  await prisma.safetyCheckIn.updateMany({
    where: {
      status: "active",
      checkInBy: { lt: new Date(now.getTime() - 2 * DAY) },
    },
    data: { status: "cancelled", endedAt: now },
  });

  // Conversations are deleted 30 days after an unmatch, unless they're part of
  // an open report or a legal hold.
  const stale = await prisma.match.findMany({
    where: {
      unmatchedAt: { lt: new Date(now.getTime() - 30 * DAY) },
      messages: { some: {} },
    },
    select: { id: true, userAId: true, userBId: true },
    take: 200,
  });
  let purged = 0;
  for (const m of stale) {
    const pair = [m.userAId, m.userBId];
    const held = await prisma.report.count({
      where: {
        reportedUserId: { in: pair },
        OR: [{ legalHold: true }, { status: "open", reporterId: { in: pair } }],
      },
    });
    if (held) continue;
    const r = await prisma.message.deleteMany({ where: { matchId: m.id } });
    purged += r.count;
  }

  const deletedAccounts = await finishHeldDeletions(prisma);
  const pruned = await pruneOldRecords(now);
  const abandonedAccounts = await deleteAbandonedSignups(now);

  return {
    deletedAccounts,
    abandonedAccounts,
    ...pruned,
    checkIns: checkIns.count,
    notifications: notifications.count,
    rateLimitBuckets: buckets.count,
    authTokens: tokens.count,
    messages: purged,
  };
}

/** People with an open report or a legal hold keep their removed posts and chat until it's settled. */
async function usersUnderReview() {
  const rows = await prisma.report.findMany({
    where: { OR: [{ legalHold: true }, { status: "open" }] },
    select: { reportedUserId: true },
    distinct: ["reportedUserId"],
  });
  return rows.map((r) => r.reportedUserId);
}

async function pruneOldRecords(now: Date) {
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const held = await usersUnderReview();
  const [posts, roomMessages, calls, unread, devices] = await Promise.all([
    prisma.post.deleteMany({
      where: { deletedAt: { lt: monthAgo }, authorId: { notIn: held } },
    }),
    prisma.roomMessage.deleteMany({
      where: { deletedAt: { lt: monthAgo }, senderId: { notIn: held } },
    }),
    prisma.call.deleteMany({
      where: {
        status: { in: ["ended", "declined", "missed"] },
        createdAt: { lt: new Date(now.getTime() - 90 * DAY) },
      },
    }),
    prisma.notification.deleteMany({
      where: {
        readAt: null,
        createdAt: { lt: new Date(now.getTime() - 180 * DAY) },
      },
    }),
    // Apple and Google stop delivering to phones that haven't opened the app in this long.
    prisma.deviceToken.deleteMany({
      where: { lastSeenAt: { lt: new Date(now.getTime() - 270 * DAY) } },
    }),
  ]);
  return {
    removedPosts: posts.count,
    removedRoomMessages: roomMessages.count,
    oldCalls: calls.count,
    oldUnreadNotifications: unread.count,
    staleDevices: devices.count,
  };
}

/**
 * Sign-ups that never confirmed their email, never went live and haven't
 * been back in 30 days are removed, so we don't hold data nobody is using.
 */
async function deleteAbandonedSignups(now: Date) {
  const abandoned = await prisma.user.findMany({
    where: {
      emailVerified: null,
      accountStatus: "ACTIVE",
      role: "MEMBER",
      lastActiveAt: { lt: new Date(now.getTime() - 30 * DAY) },
      createdAt: { lt: new Date(now.getTime() - 30 * DAY) },
      OR: [{ profile: null }, { profile: { isActive: false } }],
      reportsAgainst: { none: {} },
    },
    select: { id: true },
    take: 50,
  });
  for (const u of abandoned) await deleteAccount(prisma, u.id);
  return abandoned.length;
}
