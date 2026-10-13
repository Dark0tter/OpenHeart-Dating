import { AccountStatus, ConsentScope, Prisma, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/utils";

export type SearchFilters = {
  identityTagIds?: string[];
  orientationTagIds?: string[];
  goalTagIds?: string[];
  kinkIds?: string[];
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  verifiedOnly?: boolean;
  viewerLat?: number | null;
  viewerLng?: number | null;
  viewerUserId: string;
  limit?: number;
  cursor?: string;
};

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

async function blockedUserIds(viewerUserId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: viewerUserId }, { blockedId: viewerUserId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) =>
    b.blockerId === viewerUserId ? b.blockedId : b.blockerId,
  );
}

export async function searchProfiles(filters: SearchFilters) {
  const limit = Math.min(filters.limit ?? 24, 50);

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
      ...(filters.minAge || filters.maxAge
        ? {
            dateOfBirth: {
              ...(filters.maxAge
                ? { gte: yearsAgo(filters.maxAge + 1) }
                : {}),
              ...(filters.minAge ? { lte: yearsAgo(filters.minAge) } : {}),
            },
          }
        : {}),
    },
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

  const profiles = await prisma.profile.findMany({
    where,
    take: limit * 2,
    ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    orderBy: [{ user: { lastActiveAt: "desc" } }, { id: "asc" }],
    include: {
      identityTags: { include: { tag: true } },
      orientationTags: { include: { tag: true } },
      goalTags: { include: { tag: true } },
      seekingIdentityTags: true,
      photos: {
        where: { visibility: "PUBLIC" },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 3,
      },
      user: {
        select: {
          id: true,
          dateOfBirth: true,
          lastActiveAt: true,
          verification: { select: { status: true } },
        },
      },
    },
  });

  const viewer = await prisma.profile.findUnique({
    where: { userId: filters.viewerUserId },
    include: {
      identityTags: true,
      seekingIdentityTags: true,
    },
  });

  const viewerIdentityIds = new Set(
    viewer?.identityTags.map((t) => t.tagId) ?? [],
  );
  const viewerSeekingIds = new Set(
    viewer?.seekingIdentityTags.map((t) => t.tagId) ?? [],
  );

  const result = [];
  for (const p of profiles) {
    if (!withinDistance(p, filters)) continue;

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

    result.push(p);
    if (result.length >= limit) break;
  }

  return result;
}

function withinDistance(
  p: { latitude: number | null; longitude: number | null },
  filters: SearchFilters,
): boolean {
  if (
    filters.maxDistanceKm == null ||
    filters.viewerLat == null ||
    filters.viewerLng == null ||
    p.latitude == null ||
    p.longitude == null
  ) {
    return true;
  }
  const d = distanceKm(
    filters.viewerLat,
    filters.viewerLng,
    p.latitude,
    p.longitude,
  );
  return d <= filters.maxDistanceKm;
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
  if (
    !profile ||
    profile.user.accountStatus !== AccountStatus.ACTIVE ||
    !profile.isActive
  ) {
    return null;
  }

  if (profile.visibility !== Visibility.INCOGNITO) return profile;
  if (opts.viewerUserId === profile.userId) return profile;
  if (opts.shareToken && profile.shareToken === opts.shareToken) return profile;
  if (!opts.viewerUserId) return null;

  const allowed = await incognitoUserIdsVisibleTo(opts.viewerUserId);
  return allowed.has(profile.userId) ? profile : null;
}
