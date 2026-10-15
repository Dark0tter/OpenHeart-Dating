import { AccountStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeSupporterWhere } from "@/lib/supporter";
import { activeProvider } from "@/lib/verification";

const DAY = 24 * 60 * 60 * 1000;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);

/** A member who can be seen and matched: live profile, verified adult. */
const liveMember = {
  accountStatus: AccountStatus.ACTIVE,
  profile: { isActive: true },
  verification: { status: "VERIFIED_ADULT" as const },
};

export async function growthStats(now = new Date()) {
  const notDeleted = { accountStatus: { not: AccountStatus.DELETED } };
  const [
    accounts,
    emailConfirmed,
    ageVerified,
    live,
    new7,
    new30,
    active1,
    active7,
    active30,
    suspended,
    bans,
    supporters,
  ] = await Promise.all([
    prisma.user.count({ where: notDeleted }),
    prisma.user.count({
      where: { ...notDeleted, emailVerified: { not: null } },
    }),
    prisma.user.count({
      where: { ...notDeleted, verification: { status: "VERIFIED_ADULT" } },
    }),
    prisma.user.count({ where: liveMember }),
    prisma.user.count({
      where: { ...notDeleted, createdAt: { gte: ago(now, 7) } },
    }),
    prisma.user.count({
      where: { ...notDeleted, createdAt: { gte: ago(now, 30) } },
    }),
    prisma.user.count({
      where: { ...liveMember, lastActiveAt: { gte: ago(now, 1) } },
    }),
    prisma.user.count({
      where: { ...liveMember, lastActiveAt: { gte: ago(now, 7) } },
    }),
    prisma.user.count({
      where: { ...liveMember, lastActiveAt: { gte: ago(now, 30) } },
    }),
    prisma.user.count({ where: { accountStatus: AccountStatus.SUSPENDED } }),
    prisma.bannedIdentity.count(),
    prisma.subscription.count({ where: activeSupporterWhere(now) }),
  ]);

  const daily = await prisma.$queryRaw<{ day: Date; n: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day, count(*) AS n
    FROM "User"
    WHERE "createdAt" >= ${ago(now, 30)} AND "accountStatus" <> 'DELETED'
    GROUP BY 1 ORDER BY 1`;

  return {
    accounts,
    funnel: { accounts, emailConfirmed, ageVerified, live },
    new7,
    new30,
    active1,
    active7,
    active30,
    suspended,
    bans,
    supporters,
    signupsByDay: daily.map((d) => ({ day: d.day, count: Number(d.n) })),
  };
}

export async function queueStats() {
  const [urgent, open, photos, selfies, appeals, tickets, childSafety] =
    await Promise.all([
      prisma.report.count({ where: { status: "open", priority: "HIGH" } }),
      prisma.report.count({ where: { status: "open" } }),
      prisma.photo.count({ where: { status: "PENDING" } }),
      prisma.selfieVerification.count({ where: { status: "PENDING" } }),
      prisma.appeal.count({ where: { status: "PENDING" } }),
      prisma.supportTicket.count({ where: { status: "open" } }),
      prisma.report.count({
        where: { escalatedAt: { not: null }, externalRef: null },
      }),
    ]);
  return { urgent, open, photos, selfies, appeals, tickets, childSafety };
}

export type CityRow = {
  city: string | null;
  state: string | null;
  country: string | null;
  members: number;
  live: number;
  active30: number;
  new30: number;
};

/**
 * Members per place, merging spellings that differ only by case or spaces.
 * Counts only; no one's identity is shown.
 */
export async function cityStats(
  opts: { country?: string; limit?: number } = {},
  now = new Date(),
): Promise<CityRow[]> {
  const since = ago(now, 30);
  const country = opts.country?.trim().toLowerCase() || null;
  const rows = await prisma.$queryRaw<
    {
      city: string | null;
      state: string | null;
      country: string | null;
      members: bigint;
      live: bigint;
      active30: bigint;
      new30: bigint;
    }[]
  >`
    SELECT
      min(nullif(trim(p."city"), '')) AS city,
      min(nullif(trim(p."state"), '')) AS state,
      min(nullif(trim(p."country"), '')) AS country,
      count(*) AS members,
      count(*) FILTER (WHERE p."isActive" AND v."status" = 'VERIFIED_ADULT') AS live,
      count(*) FILTER (WHERE u."lastActiveAt" >= ${since}) AS active30,
      count(*) FILTER (WHERE u."createdAt" >= ${since}) AS new30
    FROM "Profile" p
    JOIN "User" u ON u."id" = p."userId"
    LEFT JOIN "Verification" v ON v."userId" = u."id"
    WHERE u."accountStatus" = 'ACTIVE'
      ${country ? Prisma.sql`AND lower(trim(p."country")) = ${country}` : Prisma.empty}
    GROUP BY lower(trim(coalesce(p."country", ''))),
             lower(trim(coalesce(p."state", ''))),
             lower(trim(coalesce(p."city", '')))
    ORDER BY members DESC
    LIMIT ${opts.limit ?? 300}`;
  return rows.map((r) => ({
    city: r.city,
    state: r.state,
    country: r.country,
    members: Number(r.members),
    live: Number(r.live),
    active30: Number(r.active30),
    new30: Number(r.new30),
  }));
}

export async function countryStats() {
  const rows = await prisma.$queryRaw<{ country: string | null; n: bigint }[]>`
    SELECT min(nullif(trim(p."country"), '')) AS country, count(*) AS n
    FROM "Profile" p JOIN "User" u ON u."id" = p."userId"
    WHERE u."accountStatus" = 'ACTIVE'
    GROUP BY lower(trim(coalesce(p."country", '')))
    ORDER BY n DESC LIMIT 50`;
  return rows.map((r) => ({ country: r.country, members: Number(r.n) }));
}

export async function adStats(now = new Date()) {
  const since30 = ago(now, 30);
  const since14 = ago(now, 14);
  const [placements, totals, recent, daily, preferences] = await Promise.all([
    prisma.sponsorPlacement.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.sponsorDailyStat.groupBy({
      by: ["placementId"],
      _sum: { views: true, appViews: true, clicks: true },
    }),
    prisma.sponsorDailyStat.groupBy({
      by: ["placementId"],
      where: { day: { gte: since30 } },
      _sum: { views: true, appViews: true, clicks: true },
    }),
    prisma.sponsorDailyStat.groupBy({
      by: ["day"],
      where: { day: { gte: since14 } },
      _sum: { views: true, clicks: true },
      orderBy: { day: "asc" },
    }),
    prisma.user.groupBy({
      by: ["adPreference"],
      where: { accountStatus: AccountStatus.ACTIVE },
      _count: { _all: true },
    }),
  ]);
  const sums = (list: typeof totals, id: string) => {
    const s = list.find((t) => t.placementId === id)?._sum;
    return {
      views: s?.views ?? 0,
      appViews: s?.appViews ?? 0,
      clicks: s?.clicks ?? 0,
    };
  };
  return {
    placements: placements.map((p) => ({
      ...p,
      status: !p.approvedAt
        ? "Waiting for approval"
        : !p.isActive
          ? "Paused"
          : p.endsAt && p.endsAt <= now
            ? "Ended"
            : p.startsAt > now
              ? "Scheduled"
              : "Live",
      last30: sums(recent, p.id),
      allTime: sums(totals, p.id),
    })),
    daily: daily.map((d) => ({
      day: d.day,
      views: d._sum.views ?? 0,
      clicks: d._sum.clicks ?? 0,
    })),
    preferences: Object.fromEntries(
      preferences.map((p) => [p.adPreference, p._count._all]),
    ) as Partial<Record<string, number>>,
  };
}

export async function staffList(now = new Date()) {
  const staff = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.MODERATOR, UserRole.ADMIN, UserRole.OWNER] },
    },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      lastActiveAt: true,
      totpEnabledAt: true,
      profile: { select: { displayName: true } },
    },
  });
  const actions = await prisma.modAction.groupBy({
    by: ["actorId"],
    where: {
      actorId: { in: staff.map((s) => s.id) },
      createdAt: { gte: ago(now, 30) },
    },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  return staff.map((s) => {
    const a = actions.find((x) => x.actorId === s.id);
    return {
      ...s,
      actions30: a?._count._all ?? 0,
      lastActionAt: a?._max.createdAt ?? null,
    };
  });
}

/** Which outside services are switched on. Shows only yes/no, never values. */
export function serviceChecklist() {
  const set = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]));
  const provider = activeProvider();
  return [
    {
      name: "Age verification",
      ok: provider !== null,
      detail: provider
        ? `Using ${provider}`
        : "No provider keys. Nobody can verify, so nobody can go live.",
    },
    {
      name: "Email (Resend)",
      ok: set("RESEND_API_KEY", "EMAIL_FROM"),
      detail: "Password resets, check-in alerts, notifications",
    },
    {
      name: "Ban protection secret",
      ok: set("BAN_HASH_SECRET"),
      detail: "Set once, never change",
    },
    {
      name: "Photo storage",
      ok: set("S3_BUCKET"),
      detail: "Without it photos are on the server's disk",
    },
    {
      name: "Photo safety scanning",
      ok: set("IMAGE_SCAN_URL"),
      detail: "Automatic checks before review",
    },
    {
      name: "Browser notifications",
      ok: set("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"),
      detail: "",
    },
    {
      name: "Phone app notifications",
      ok: set("APNS_KEY_ID") || set("FCM_SERVICE_ACCOUNT_JSON"),
      detail: "iPhone (APNs) or Android (Firebase)",
    },
    {
      name: "Bot protection (Turnstile)",
      ok: set("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
      detail: "",
    },
    { name: "Error tracking (Sentry)", ok: set("SENTRY_DSN"), detail: "" },
    {
      name: "Call relay (TURN)",
      ok: set("TURN_URLS"),
      detail: "Helps calls connect on strict networks",
    },
    {
      name: "Support email",
      ok: set("SUPPORT_EMAIL"),
      detail: "Shown on Terms and child-safety pages",
    },
    {
      name: "Dev verification stub off",
      ok: process.env.ALLOW_VERIFICATION_STUB !== "true",
      detail: "Must be off for real users",
    },
  ];
}
