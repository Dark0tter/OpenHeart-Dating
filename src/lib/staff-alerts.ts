import { ReportReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/request";
import { EMERGENCY_REASONS } from "@/lib/safety";

/**
 * Keeps a small (even one-person) team on top of the queue: urgent reports
 * alert every staff member at once by push, in-app and email, and a daily
 * summary email lists everything waiting. Emails never include what members
 * wrote — only counts, reasons and links into /mod.
 */

const DAY = 24 * 60 * 60 * 1000;

const URGENT_LABEL: Partial<Record<ReportReason, string>> = {
  THREATS: "Threats of violence",
  UNDERAGE: "Possible under-18 member",
  EMERGENCY: "Emergency",
  NON_CONSENSUAL_CONTENT: "Non-consensual images",
};

type Recipient = { id: string | null; email: string };

/** Active moderators and admins; SUPPORT_EMAIL if nobody has been appointed yet. */
async function recipients(): Promise<Recipient[]> {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MODERATOR"] }, accountStatus: "ACTIVE" },
    select: { id: true, email: true },
  });
  if (staff.length > 0) return staff;
  const fallback = process.env.SUPPORT_EMAIL;
  if (fallback) return [{ id: null, email: fallback }];
  console.warn("[staff-alerts] no staff and no SUPPORT_EMAIL; nobody to alert");
  return [];
}

export async function staffAlerts(now: Date) {
  const pending = await prisma.report.findMany({
    where: {
      status: "open",
      staffAlertedAt: null,
      reason: { in: EMERGENCY_REASONS },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, reason: true },
  });
  if (pending.length === 0) return { alerted: 0 };
  const to = await recipients();
  if (to.length === 0) return { alerted: 0 };

  const one = pending.length === 1 ? pending[0] : null;
  const title = one
    ? `Urgent report: ${URGENT_LABEL[one.reason] ?? one.reason}`
    : `${pending.length} urgent reports waiting`;
  const link = one ? `/mod/reports/${one.id}` : "/mod/reports";
  const reasons = [
    ...new Set(pending.map((r) => URGENT_LABEL[r.reason] ?? r.reason)),
  ];

  for (const r of to) {
    if (r.id) {
      await notify(r.id, {
        type: "staff_alert",
        title,
        body: reasons.join(", "),
        link,
      });
    }
    await sendEmail({
      to: r.email,
      subject: `[OpenHeart] ${title}`,
      paragraphs: [
        one
          ? "A member filed an urgent report. Please review it as soon as you can."
          : `Members filed ${pending.length} urgent reports: ${reasons.join(", ")}. Please review them as soon as you can.`,
        "If someone may be in immediate danger, contact local emergency services. For anything involving a minor, use the child-safety escalation on the report page.",
      ],
      action: { label: "Open the report queue", url: `${appUrl()}${link}` },
    });
  }

  await prisma.report.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { staffAlertedAt: now },
  });
  return { alerted: pending.length };
}

function digestHourUtc(): number {
  const h = Number(process.env.STAFF_DIGEST_HOUR_UTC);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 13;
}

/** Once a day (STAFF_DIGEST_HOUR_UTC, default 13:00 UTC = 9am US Eastern). */
export async function dailyDigest(now: Date) {
  const due = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      digestHourUtc(),
    ),
  );
  if (now < due) return { sent: false };
  const state = await prisma.jobState.findUnique({
    where: { key: "staff_digest" },
  });
  if (state && state.lastRunAt >= due) return { sent: false };
  await prisma.jobState.upsert({
    where: { key: "staff_digest" },
    create: { key: "staff_digest", lastRunAt: now },
    update: { lastRunAt: now },
  });

  const dayAgo = new Date(now.getTime() - DAY);
  const [
    openReports,
    urgentReports,
    overdueReports,
    newReports,
    photos,
    selfies,
    appeals,
    tickets,
    newMembers,
  ] = await Promise.all([
    prisma.report.count({ where: { status: "open" } }),
    prisma.report.count({
      where: { status: "open", reason: { in: EMERGENCY_REASONS } },
    }),
    prisma.report.count({
      where: { status: "open", createdAt: { lt: dayAgo } },
    }),
    prisma.report.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.photo.count({ where: { status: "PENDING" } }),
    prisma.selfieVerification.count({ where: { status: "PENDING" } }),
    prisma.appeal.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);

  const waiting = openReports + photos + selfies + appeals + tickets;
  if (waiting === 0) return { sent: false, empty: true };

  const lines = [
    `Open reports: ${openReports}${urgentReports ? ` (${urgentReports} urgent)` : ""}`,
    ...(overdueReports
      ? [
          `Reports waiting more than 24 hours: ${overdueReports} — the Terms promise a review within 24 hours.`,
        ]
      : []),
    `Photos to review: ${photos}`,
    `Selfie verifications to review: ${selfies}`,
    `Appeals to decide: ${appeals}`,
    `Support requests: ${tickets}`,
    `In the last 24 hours: ${newReports} new reports, ${newMembers} new members.`,
  ];

  for (const r of await recipients()) {
    await sendEmail({
      to: r.email,
      subject: `[OpenHeart] Daily summary: ${waiting} item${waiting === 1 ? "" : "s"} waiting`,
      paragraphs: lines,
      action: {
        label: "Open the moderation dashboard",
        url: `${appUrl()}/mod`,
      },
    });
  }
  return { sent: true, waiting };
}
