import {
  AdPreference,
  ContentTier,
  KinkInterestLevel,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSupporter } from "@/lib/supporter";

const POSITIVE_LEVELS: KinkInterestLevel[] = [
  "FAVORITE",
  "INTERESTED",
  "CURIOUS",
];

/** Cookie holding how often this browser saw each placement today. Never sent to the server's database. */
export const SEEN_COOKIE = "oh_sp_seen";

/** The apps get fewer repeats than the website. */
export const APP_DAILY_CAP = 2;

export type Seen = Record<string, number>;

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Format: `YYYY-MM-DD|id:count,id:count`. Counts from earlier days are dropped. */
export function parseSeen(raw: string | undefined, now: Date): Seen {
  if (!raw) return {};
  const [day, list] = raw.split("|");
  if (day !== utcDay(now) || !list) return {};
  const seen: Seen = {};
  for (const pair of list.split(",").slice(0, 50)) {
    const [id, n] = pair.split(":");
    const count = Number(n);
    if (
      id &&
      /^[\w-]{1,64}$/.test(id) &&
      Number.isInteger(count) &&
      count > 0
    ) {
      seen[id] = count;
    }
  }
  return seen;
}

export function serializeSeen(seen: Seen, now: Date): string {
  const list = Object.entries(seen)
    .slice(-50)
    .map(([id, n]) => `${id}:${n}`)
    .join(",");
  return `${utcDay(now)}|${list}`;
}

export function capFor(placement: { dailyCap: number }, app: boolean): number {
  const cap = Math.max(1, placement.dailyCap);
  return app ? Math.min(cap, APP_DAILY_CAP) : cap;
}

export function underCap(
  placement: { id: string; dailyCap: number },
  seen: Seen,
  app: boolean,
): boolean {
  return (seen[placement.id] ?? 0) < capFor(placement, app);
}

/** Only https links to somewhere other than this site. */
export function isSafeSponsorUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** The apps only ever get creatives approved as suitable for everyone. */
export function sponsorTiers(
  tiers: ContentTier[],
  app: boolean,
): ContentTier[] {
  return app ? tiers.filter((t) => t === ContentTier.STANDARD) : tiers;
}

export function activePlacementWhere(
  tiers: ContentTier[],
  now: Date,
): Prisma.SponsorPlacementWhereInput {
  return {
    contentTier: { in: tiers },
    isActive: true,
    approvedAt: { not: null },
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

/**
 * Picks at most one placement using only what the member put on their profile.
 * Nothing about the viewer is stored or sent to the sponsor.
 */
export async function pickSponsorPlacement(
  userId: string | null,
  tiers: ContentTier[],
  opts: { app?: boolean; seen?: Seen; now?: Date } = {},
) {
  const app = opts.app ?? false;
  const seen = opts.seen ?? {};
  const now = opts.now ?? new Date();
  const active = activePlacementWhere(sponsorTiers(tiers, app), now);
  const untargeted: Prisma.SponsorPlacementWhereInput = {
    targetKinkSlugs: { isEmpty: true },
    targetGoalSlugs: { isEmpty: true },
  };
  const pick = <T extends { id: string; dailyCap: number }>(items: T[]) =>
    pickRandom(items.filter((p) => underCap(p, seen, app)));

  if (!userId) {
    return pick(
      await prisma.sponsorPlacement.findMany({
        where: { ...active, ...untargeted },
      }),
    );
  }

  const [user, supporter] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { adPreference: true },
    }),
    isSupporter(userId),
  ]);
  const preference = user?.adPreference ?? AdPreference.GENERIC;

  if (supporter && preference === AdPreference.NONE) return null;

  if (preference !== AdPreference.PROFILE_INTERESTS) {
    return pick(
      await prisma.sponsorPlacement.findMany({
        where: { ...active, ...untargeted },
      }),
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      kinks: {
        where: { kink: { tier: { in: tiers } } },
        select: { level: true, kink: { select: { slug: true } } },
      },
      goalTags: { select: { tag: { select: { slug: true } } } },
    },
  });

  const liked = new Set<string>();
  const limits = new Set<string>();
  for (const k of profile?.kinks ?? []) {
    (POSITIVE_LEVELS.includes(k.level) ? liked : limits).add(k.kink.slug);
  }
  const goals = (profile?.goalTags ?? []).map((g) => g.tag.slug);

  const candidates = await prisma.sponsorPlacement.findMany({
    where: {
      ...active,
      AND: [
        {
          OR: [
            { targetKinkSlugs: { hasSome: [...liked] } },
            { targetGoalSlugs: { hasSome: goals } },
          ],
        },
      ],
    },
  });

  // Never show a placement for something the member marked as a soft or hard limit.
  const targeted = candidates.filter(
    (c) => !c.targetKinkSlugs.some((slug) => limits.has(slug)),
  );
  const chosen = pick(targeted);
  if (chosen) return chosen;

  return pick(
    await prisma.sponsorPlacement.findMany({
      where: { ...active, ...untargeted },
    }),
  );
}

/** Adds one view or click to today's anonymous totals. */
export async function recordSponsorEvent(
  placementId: string,
  kind: "view" | "click",
  app: boolean,
  now = new Date(),
) {
  const day = new Date(`${utcDay(now)}T00:00:00.000Z`);
  const inc =
    kind === "click"
      ? { clicks: 1 }
      : app
        ? { views: 1, appViews: 1 }
        : { views: 1 };
  await prisma.sponsorDailyStat.upsert({
    where: { placementId_day: { placementId, day } },
    create: { placementId, day, ...inc },
    update: Object.fromEntries(
      Object.entries(inc).map(([k, v]) => [k, { increment: v }]),
    ),
  });
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}
