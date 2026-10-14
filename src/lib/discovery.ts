import {
  AccountStatus,
  ConsentScope,
  Prisma,
  Visibility,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { blockedUserIds, isBlockedEitherWay } from "@/lib/safety";
import { distanceKm } from "@/lib/utils";
import { scoreMatch, type RankProfile } from "@/lib/ranking";

export type SearchSort = "best" | "recent" | "nearest";

export type SearchFilters = {
  identityTagIds?: string[];
  orientationTagIds?: string[];
  goalTagIds?: string[];
  kinkIds?: string[];
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  verifiedOnly?: boolean;
  photoVerifiedOnly?: boolean;
  hasPhoto?: boolean;
  viewerLat?: number | null;
  viewerLng?: number | null;
  viewerUserId: string;
  sort?: SearchSort;
  limit?: number;
  page?: number;
};

/** Candidates considered per search; ranking happens on this pool. */
const POOL_SIZE = 300;

/**
 * Incognito owners the viewer may see: an active match, the incognito owner
 * liked or messaged the viewer first, or the owner granted explicit profile access.
 * A like from the viewer to the incognito user does not count, otherwise anyone
 * who liked someone before they went incognito could still find them.
 */
export async function incognitoUserIdsVisibleTo(
  viewerUserId: string,
): Promise<Set<string>> {
  const [matches, likesFromThem, requestsFromThem, grants] = await Promise.all([
    prisma.match.findMany({
      where: {
        unmatchedAt: null,
        OR: [{ userAId: viewerUserId }, { userBId: viewerUserId }],
      },
      select: { userAId: true, userBId: true },
    }),
    prisma.like.findMany({
      where: { toUserId: viewerUserId },
      select: { fromUserId: true },
    }),
    prisma.messageRequest.findMany({
      where: { toUserId: viewerUserId },
      select: { fromUserId: true },
    }),
    prisma.consentGrant.findMany({
      where: {
        viewerId: viewerUserId,
        scope: ConsentScope.PROFILE_ACCESS,
        revokedAt: null,
      },
      select: { granterId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const m of matches) {
    ids.add(m.userAId === viewerUserId ? m.userBId : m.userAId);
  }
  for (const l of likesFromThem) ids.add(l.fromUserId);
  for (const r of requestsFromThem) ids.add(r.fromUserId);
  for (const g of grants) ids.add(g.granterId);
  return ids;
}

const rankInclude = {
  identityTags: { include: { tag: true } },
  orientationTags: { include: { tag: true } },
  goalTags: { include: { tag: true } },
  relationshipStyleTags: { include: { tag: true } },
  seekingIdentityTags: true,
  kinks: { select: { kinkId: true, level: true } },
  _count: { select: { prompts: true } },
  photos: {
    where: { visibility: "PUBLIC", status: "APPROVED" },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 3,
  },
  user: {
    select: {
      id: true,
      dateOfBirth: true,
      lastActiveAt: true,
      photoVerifiedAt: true,
      verification: { select: { status: true } },
    },
  },
} satisfies Prisma.ProfileInclude;

type RankedRow = Prisma.ProfileGetPayload<{ include: typeof rankInclude }>;

function toRankProfile(p: RankedRow): RankProfile {
  return {
    identityIds: p.identityTags.map((t) => t.tagId),
    seekingIdentityIds: p.seekingIdentityTags.map((t) => t.tagId),
    goalIds: p.goalTags.map((t) => t.tagId),
    styleIds: p.relationshipStyleTags.map((t) => t.tagId),
    kinks: p.kinks,
    latitude: p.latitude,
    longitude: p.longitude,
    lastActiveAt: p.user.lastActiveAt,
    publicPhotos: p.photos.length,
    bioLength: p.bio?.trim().length ?? 0,
    promptCount: p._count.prompts,
    photoVerified: Boolean(p.user.photoVerifiedAt),
    ageVerified: p.user.verification?.status === "VERIFIED_ADULT",
  };
}

export async function searchProfiles(filters: SearchFilters) {
  const limit = Math.min(filters.limit ?? 24, 50);
  const page = Math.max(filters.page ?? 0, 0);
  const sort = filters.sort ?? "best";

  const [blocked, incognitoAllowed] = await Promise.all([
    blockedUserIds(filters.viewerUserId),
    incognitoUserIdsVisibleTo(filters.viewerUserId),
  ]);

  const where: Prisma.ProfileWhereInput = {
    isActive: true,
    userId: { not: filters.viewerUserId, notIn: blocked },
    OR: [
      { visibility: { in: [Visibility.PUBLIC, Visibility.LIMITED] } },
      {
        visibility: Visibility.INCOGNITO,
        userId: { in: [...incognitoAllowed] },
      },
    ],
    user: {
      accountStatus: AccountStatus.ACTIVE,
      ...(filters.verifiedOnly
        ? { verification: { status: "VERIFIED_ADULT" } }
        : {}),
      ...(filters.photoVerifiedOnly ? { photoVerifiedAt: { not: null } } : {}),
      ...(filters.minAge || filters.maxAge
        ? {
            dateOfBirth: {
              ...(filters.maxAge ? { gte: yearsAgo(filters.maxAge + 1) } : {}),
              ...(filters.minAge ? { lte: yearsAgo(filters.minAge) } : {}),
            },
          }
        : {}),
    },
    ...(filters.hasPhoto
      ? { photos: { some: { visibility: "PUBLIC", status: "APPROVED" } } }
      : {}),
    ...(filters.identityTagIds?.length
      ? { identityTags: { some: { tagId: { in: filters.identityTagIds } } } }
      : {}),
    ...(filters.orientationTagIds?.length
      ? {
          orientationTags: {
            some: { tagId: { in: filters.orientationTagIds } },
          },
        }
      : {}),
    ...(filters.goalTagIds?.length
      ? { goalTags: { some: { tagId: { in: filters.goalTagIds } } } }
      : {}),
    ...(filters.kinkIds?.length
      ? {
          kinks: {
            some: {
              kinkId: { in: filters.kinkIds },
              level: { in: ["FAVORITE", "INTERESTED", "CURIOUS"] },
            },
          },
        }
      : {}),
  };

  const [pool, viewer] = await Promise.all([
    prisma.profile.findMany({
      where,
      take: POOL_SIZE,
      orderBy: [{ user: { lastActiveAt: "desc" } }, { id: "asc" }],
      include: rankInclude,
    }),
    prisma.profile.findUnique({
      where: { userId: filters.viewerUserId },
      include: rankInclude,
    }),
  ]);

  const viewerRank = viewer ? toRankProfile(viewer) : null;
  const viewerIdentityIds = new Set(viewerRank?.identityIds ?? []);
  const viewerSeekingIds = new Set(viewerRank?.seekingIdentityIds ?? []);

  const candidates = [];
  for (const p of pool) {
    const km = kmBetween(filters, p);
    if (
      filters.maxDistanceKm != null &&
      km != null &&
      km > filters.maxDistanceKm
    ) {
      continue;
    }

    if (p.visibility === Visibility.LIMITED) {
      if (!viewer) continue;
      const seeksThem = p.identityTags.some((t) =>
        viewerSeekingIds.has(t.tagId),
      );
      const theySeekViewer = p.seekingIdentityTags.some((s) =>
        viewerIdentityIds.has(s.tagId),
      );
      if (!seeksThem || !theySeekViewer) continue;
    }

    const score = viewerRank
      ? scoreMatch(viewerRank, toRankProfile(p)).total
      : 0;
    candidates.push({ profile: p, km, score });
  }

  if (sort === "best") {
    candidates.sort((a, b) => b.score - a.score);
  } else if (sort === "nearest") {
    candidates.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }

  const start = page * limit;
  return {
    results: candidates.slice(start, start + limit),
    hasMore: candidates.length > start + limit,
  };
}

function kmBetween(
  filters: SearchFilters,
  p: { latitude: number | null; longitude: number | null },
): number | null {
  if (
    filters.viewerLat == null ||
    filters.viewerLng == null ||
    p.latitude == null ||
    p.longitude == null
  ) {
    return null;
  }
  return distanceKm(
    filters.viewerLat,
    filters.viewerLng,
    p.latitude,
    p.longitude,
  );
}

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

/** Incognito profiles are never in search, browse, feed, or public URLs unless access applies. */
export async function assertProfileViewable(opts: {
  profileUserId: string;
  viewerUserId: string | null;
  shareToken?: string | null;
}) {
  const profile = await prisma.profile.findUnique({
    where: { userId: opts.profileUserId },
    include: {
      user: { select: { accountStatus: true } },
    },
  });
  if (!profile || profile.user.accountStatus !== AccountStatus.ACTIVE) {
    return null;
  }
  if (opts.viewerUserId === profile.userId) return profile;
  if (!profile.isActive) return null;

  if (
    opts.viewerUserId &&
    (await isBlockedEitherWay(opts.viewerUserId, profile.userId))
  ) {
    return null;
  }
  if (profile.visibility !== Visibility.INCOGNITO) return profile;
  if (opts.shareToken && profile.shareToken === opts.shareToken) return profile;
  if (!opts.viewerUserId) return null;

  const allowed = await incognitoUserIdsVisibleTo(opts.viewerUserId);
  return allowed.has(profile.userId) ? profile : null;
}
