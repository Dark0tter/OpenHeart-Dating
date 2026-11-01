import { NextResponse } from "next/server";
import { ConsentScope, InterestLevel, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { assertProfileViewable } from "@/lib/discovery";
import { allowedTiers, isAppRequest } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import { galleryFor } from "@/lib/photos";
import { promptQuestion } from "@/lib/constants/prompts";
import { findClashes } from "@/lib/limits";
import { supporterBadges } from "@/lib/supporter";
import {
  activityLabel,
  ageFromDob,
  approxDistanceLabel,
  distanceKm,
  orderedPair,
} from "@/lib/utils";

type Ctx = { params: Promise<{ userId: string }> };

const SHOWN_LEVELS: InterestLevel[] = [
  InterestLevel.FAVORITE,
  InterestLevel.INTERESTED,
  InterestLevel.CURIOUS,
  InterestLevel.NO,
  InterestLevel.HARD_LIMIT,
];

export async function GET(req: Request, ctx: Ctx) {
  const viewer = await requireMember();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await ctx.params;

  const visible = await assertProfileViewable({
    profileUserId: userId,
    viewerUserId: viewer.id,
    shareToken: new URL(req.url).searchParams.get("share"),
  });
  if (!visible) {
    return NextResponse.json(
      { error: "Member not available" },
      { status: 404 },
    );
  }

  const tiers = await allowedTiers(viewer);
  const filterText = textFilterFor(tiers);

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    include: {
      user: {
        select: {
          dateOfBirth: true,
          lastActiveAt: true,
          photoVerifiedAt: true,
          verification: { select: { status: true } },
        },
      },
      identityTags: { include: { tag: true } },
      orientationTags: { include: { tag: true } },
      goalTags: { include: { tag: true } },
      relationshipStyleTags: { include: { tag: true } },
      bodyTags: { include: { tag: true } },
      ethnicityTags: { include: { tag: true } },
      accessibilityTags: { include: { tag: true } },
      interests: {
        where: { level: { in: SHOWN_LEVELS }, interest: { tier: { in: tiers } } },
        include: { interest: { select: { name: true } } },
      },
      prompts: { orderBy: { sortOrder: "asc" } },
    },
  });

  const isSelf = viewer.id === userId;
  const [a, b] = orderedPair(viewer.id, userId);
  const [
    gallery,
    youLiked,
    likedYou,
    match,
    following,
    albumRequests,
    viewerInterests,
    profileShared,
  ] = await Promise.all([
    galleryFor(userId, viewer, false),
    prisma.like.findUnique({
      where: {
        fromUserId_toUserId: { fromUserId: viewer.id, toUserId: userId },
      },
      select: { id: true },
    }),
    prisma.like.findUnique({
      where: {
        fromUserId_toUserId: { fromUserId: userId, toUserId: viewer.id },
      },
      select: { id: true },
    }),
    prisma.match.findFirst({
      where: { userAId: a, userBId: b, unmatchedAt: null },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewer.id,
          followingId: userId,
        },
      },
      select: { followerId: true },
    }),
    prisma.consentRequest.findMany({
      where: {
        requesterId: viewer.id,
        ownerId: userId,
        scope: ConsentScope.PRIVATE_ALBUM,
      },
      select: { scope: true, status: true },
    }),
    isSelf || !viewer.profile
      ? []
      : prisma.profileInterest.findMany({
          where: {
            profileId: viewer.profile.id,
            interest: { tier: { in: tiers } },
          },
          select: { interestId: true, level: true },
        }),
    prisma.consentGrant.findFirst({
      where: {
        granterId: viewer.id,
        viewerId: userId,
        scope: ConsentScope.PROFILE_ACCESS,
        revokedAt: null,
      },
      select: { id: true },
    }),
  ]);

  const clashes = findClashes(
    viewerInterests,
    profile.interests.map((k) => ({
      interestId: k.interestId,
      level: k.level,
      name: k.interest.name,
    })),
  );

  const v = viewer.profile;
  const distance =
    !isSelf &&
    v?.latitude != null &&
    v.longitude != null &&
    profile.latitude != null &&
    profile.longitude != null
      ? approxDistanceLabel(
          distanceKm(
            v.latitude,
            v.longitude,
            profile.latitude,
            profile.longitude,
          ),
        )
      : null;

  const interestsAt = (level: InterestLevel) =>
    profile.interests.filter((k) => k.level === level).map((k) => k.interest.name);

  return NextResponse.json({
    member: {
      userId,
      isSelf,
      displayName: profile.displayName,
      pronouns: profile.pronouns,
      age: ageFromDob(profile.user.dateOfBirth),
      bio: profile.bio ? filterText(profile.bio) : null,
      location:
        [profile.city, profile.state].filter(Boolean).join(", ") || null,
      distance,
      activity: activityLabel(profile.user.lastActiveAt),
      ageVerified: profile.user.verification?.status === "VERIFIED_ADULT",
      photoVerified: Boolean(profile.user.photoVerifiedAt),
      supporter:
        !(await isAppRequest()) &&
        (await supporterBadges([userId])).has(userId),
      identity: profile.identityTags.map((t) => t.tag.label),
      orientation: profile.orientationTags.map((t) => t.tag.label),
      goals: profile.goalTags.map((t) => t.tag.label),
      relationshipStyles: profile.relationshipStyleTags.map((t) => t.tag.label),
      body: profile.bodyTags.map((t) => t.tag.label),
      ethnicity: profile.ethnicityTags.map((t) => t.tag.label),
      accessibility: profile.accessibilityTags.map((t) => t.tag.label),
      interests: {
        favorite: interestsAt(InterestLevel.FAVORITE),
        interested: interestsAt(InterestLevel.INTERESTED),
        curious: interestsAt(InterestLevel.CURIOUS),
        softLimits: interestsAt(InterestLevel.NO),
        hardLimits: interestsAt(InterestLevel.HARD_LIMIT),
      },
      limitsNote: profile.limitsNote ? filterText(profile.limitsNote) : null,
      clashes,
      limitsCompared: viewerInterests.length > 0 && profile.interests.length > 0,
      prompts: profile.prompts.flatMap((p) => {
        const question = promptQuestion(p.promptId);
        return question ? [{ question, answer: filterText(p.answer) }] : [];
      }),
    },
    gallery,
    relationship: {
      youLiked: Boolean(youLiked),
      likedYou: Boolean(likedYou),
      matchId: match?.id ?? null,
      following: Boolean(following),
      youAreIncognito: viewer.profile?.visibility === Visibility.INCOGNITO,
      profileShared: Boolean(profileShared),
      albumRequests: Object.fromEntries(
        albumRequests.map((r) => [r.scope, r.status]),
      ) as Partial<Record<ConsentScope, string>>,
    },
  });
}
