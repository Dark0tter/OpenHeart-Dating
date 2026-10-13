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

/**
 * Picks at most one placement using only what the member put on their profile.
 * Nothing about the viewer is stored or sent to the sponsor.
 */
export async function pickSponsorPlacement(
  userId: string | null,
  tiers: ContentTier[],
) {
  const now = new Date();
  const active: Prisma.SponsorPlacementWhereInput = {
    contentTier: { in: tiers },
    isActive: true,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
  const untargeted: Prisma.SponsorPlacementWhereInput = {
    targetKinkSlugs: { isEmpty: true },
    targetGoalSlugs: { isEmpty: true },
  };

  if (!userId) {
    return pickRandom(
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
    return pickRandom(
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
      OR: [
        { targetKinkSlugs: { hasSome: [...liked] } },
        { targetGoalSlugs: { hasSome: goals } },
      ],
    },
  });

  // Never show a placement for something the member marked as No or Hard Limit.
  const targeted = candidates.filter(
    (c) => !c.targetKinkSlugs.some((slug) => limits.has(slug)),
  );
  if (targeted.length > 0) return pickRandom(targeted);

  return pickRandom(
    await prisma.sponsorPlacement.findMany({
      where: { ...active, ...untargeted },
    }),
  );
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}
