import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Supporter is a voluntary, website-only donation. Its thank-you perks are
 * cosmetic and never apply inside the apps (store payment rules). An admin
 * grants it by hand until a payment processor is connected.
 */
export const SUPPORTER_PERKS = [
  "A Supporter badge on your profile on the website (you can hide it)",
  "The option to hide the sponsor block on the website",
  "Keeping OpenHeart free, independent, and tracker-free for everyone",
];

const DAY = 24 * 60 * 60 * 1000;

export function activeSupporterWhere(
  now = new Date(),
): Prisma.SubscriptionWhereInput {
  return {
    plan: "supporter",
    status: "active",
    OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
  };
}

export async function isSupporter(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, ...activeSupporterWhere() },
    select: { id: true },
  });
  return Boolean(sub);
}

export async function supporterStatus(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const active = Boolean(
    sub &&
    sub.plan === "supporter" &&
    sub.status === "active" &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date()),
  );
  return {
    active,
    until: active ? (sub?.currentPeriodEnd ?? null) : null,
    showBadge: sub?.showBadge ?? true,
    provider: sub?.provider ?? null,
    note: sub?.note ?? null,
  };
}

/** Members (of the given ids) whose Supporter badge should show. */
export async function supporterBadges(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const subs = await prisma.subscription.findMany({
    where: {
      userId: { in: userIds },
      showBadge: true,
      ...activeSupporterWhere(),
    },
    select: { userId: true },
  });
  return new Set(subs.map((s) => s.userId));
}

/** Adds months on top of any time already left. */
export function extendedUntil(
  current: Date | null,
  months: number,
  now = new Date(),
): Date {
  const start = current && current > now ? current : now;
  return new Date(start.getTime() + Math.round(months * 30.44) * DAY);
}

export async function grantSupporter(opts: {
  userId: string;
  months: number;
  provider?: string;
  note?: string | null;
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  const existing = await prisma.subscription.findUnique({
    where: { userId: opts.userId },
  });
  const stillActive =
    existing?.plan === "supporter" && existing.status === "active";
  const until = extendedUntil(
    stillActive ? existing.currentPeriodEnd : null,
    opts.months,
    now,
  );
  const data = {
    plan: "supporter",
    status: "active",
    provider: opts.provider ?? "manual",
    currentPeriodEnd: until,
    ...(opts.note ? { note: opts.note } : {}),
  };
  return prisma.subscription.upsert({
    where: { userId: opts.userId },
    create: { userId: opts.userId, ...data },
    update: data,
  });
}

export async function endSupporter(userId: string) {
  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: "canceled", currentPeriodEnd: new Date() },
  });
  await prisma.user.updateMany({
    where: { id: userId, adPreference: "NONE" },
    data: { adPreference: "GENERIC" },
  });
}
